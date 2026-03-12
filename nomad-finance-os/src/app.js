const path = require("node:path");
const express = require("express");
const { z } = require("zod");
const {
  ACCOUNT_TYPES,
  DEFAULT_EXPENSE_CATEGORIES,
  FIXED_COST_L2,
  SUPPORTED_CURRENCIES,
  TRANSFER_REASONS,
  TRANSACTION_TYPES
} = require("./constants");
const { ensureUserAndSeedDefaults, normalizeMonth } = require("./db");
const { fallbackFxRate, fetchFxRate, normalizeCurrency } = require("./fx");
const { encryptText } = require("./security");
const { buildExtractionDraft } = require("./ai");

function createApp(db) {
  const app = express();
  app.use(express.json({ limit: "8mb" }));
  app.use(express.static(path.join(__dirname, "public")));

  app.use((req, res, next) => {
    const rawUserId = req.header("x-user-id") || "1";
    const userId = Number.parseInt(rawUserId, 10);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ error: "Invalid x-user-id header." });
    }
    req.userId = userId;
    ensureUserAndSeedDefaults(db, userId);
    return next();
  });

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/api/v1/settings", (req, res) => {
    res.json(getUserSettings(db, req.userId));
  });

  app.put("/api/v1/settings", (req, res) => {
    const schema = z.object({
      base_currency: z.string().min(3).max(8).optional(),
      timezone: z.string().min(2).max(100).optional(),
      ui_language: z.enum(["en", "zh"]).optional()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const payload = parsed.data;
    const current = getUserSettings(db, req.userId);
    let baseCurrency = current.base_currency;
    if (payload.base_currency) {
      try {
        baseCurrency = normalizeSupportedCurrency(payload.base_currency, "base_currency");
      } catch (error) {
        return res.status(400).json({ error: String(error.message || "Invalid base_currency.") });
      }
    }
    const timezone = payload.timezone || current.timezone;
    const uiLanguage = payload.ui_language || current.ui_language;
    db.prepare(
      `
        UPDATE user_settings
        SET base_currency = ?, timezone = ?, ui_language = ?, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `
    ).run(baseCurrency, timezone, uiLanguage, req.userId);
    res.json(getUserSettings(db, req.userId));
  });

  app.get("/api/v1/fx/supported-currencies", (_req, res) => {
    res.json({ currencies: SUPPORTED_CURRENCIES });
  });

  app.get("/api/v1/fx/quote", async (req, res) => {
    let from;
    let to;
    try {
      from = normalizeSupportedCurrency(req.query.from || "USD", "from");
      to = normalizeSupportedCurrency(req.query.to || "USD", "to");
    } catch (error) {
      return res.status(400).json({ error: String(error.message || "Invalid currency.") });
    }
    const fx = await fetchFxRate(from, to);
    res.json({
      from,
      to,
      rate: fx.rate,
      source: fx.source,
      timestamp: new Date().toISOString()
    });
  });

  app.get("/api/v1/categories", (req, res) => {
    res.json(getCategoriesMap(db, req.userId));
  });

  app.post("/api/v1/categories/l1", (req, res) => {
    const schema = z.object({ name: z.string().min(1).max(64) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const name = parsed.data.name.trim();
    db.prepare(
      `
        INSERT INTO expense_category_l1 (user_id, name, is_default, active)
        VALUES (?, ?, 0, 1)
        ON CONFLICT(user_id, name) DO UPDATE SET active = 1
      `
    ).run(req.userId, name);
    res.status(201).json({ name, active: true });
  });

  app.patch("/api/v1/categories/l1/:name", (req, res) => {
    const schema = z.object({ active: z.boolean() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const result = db
      .prepare("UPDATE expense_category_l1 SET active = ? WHERE user_id = ? AND name = ?")
      .run(parsed.data.active ? 1 : 0, req.userId, String(req.params.name).trim());
    if (result.changes === 0) {
      return res.status(404).json({ error: "Category L1 not found." });
    }
    res.json({ ok: true });
  });

  app.post("/api/v1/categories/l2", (req, res) => {
    const schema = z.object({
      l1_name: z.string().min(1).max(64),
      name: z.string().min(1).max(64)
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const l1Name = parsed.data.l1_name.trim();
    const l2Name = parsed.data.name.trim();
    const l1 = db
      .prepare(
        "SELECT id FROM expense_category_l1 WHERE user_id = ? AND name = ? AND active = 1"
      )
      .get(req.userId, l1Name);
    if (!l1) {
      return res
        .status(400)
        .json({ error: "Category L1 does not exist or is inactive for this user." });
    }
    db.prepare(
      `
        INSERT INTO expense_category_l2 (user_id, l1_id, name, is_default, active)
        VALUES (?, ?, ?, 0, 1)
        ON CONFLICT(user_id, l1_id, name) DO UPDATE SET active = 1
      `
    ).run(req.userId, l1.id, l2Name);
    res.status(201).json({ l1_name: l1Name, name: l2Name, active: true });
  });

  app.post("/api/v1/accounts", (req, res) => {
    const schema = z.object({
      name: z.string().min(1).max(128),
      type: z.enum(ACCOUNT_TYPES),
      currency: z.string().min(3).max(8),
      balance: z.number().finite().default(0)
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const payload = parsed.data;
    let accountCurrency;
    try {
      accountCurrency = normalizeSupportedCurrency(payload.currency, "currency");
    } catch (error) {
      return res.status(400).json({ error: String(error.message || "Invalid currency.") });
    }
    const result = db
      .prepare(
        `
          INSERT INTO accounts (user_id, name, type, currency, opening_balance, balance)
          VALUES (?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        req.userId,
        payload.name.trim(),
        payload.type,
        accountCurrency,
        payload.balance,
        payload.balance
      );
    const account = db
      .prepare("SELECT * FROM accounts WHERE user_id = ? AND id = ?")
      .get(req.userId, Number(result.lastInsertRowid));
    res.status(201).json(account);
  });

  app.get("/api/v1/accounts", (req, res) => {
    const rows = db
      .prepare("SELECT * FROM accounts WHERE user_id = ? ORDER BY id")
      .all(req.userId);
    res.json(rows);
  });

  app.post("/api/v1/admin/rebuild-balances", (req, res) => {
    const result = rebuildUserBalances(db, req.userId);
    res.status(201).json(result);
  });

  app.get("/api/v1/tags", (req, res) => {
    const rows = db
      .prepare(
        `
          SELECT tg.name, COUNT(*) AS usage_count
          FROM tags tg
          JOIN transaction_tags tt ON tt.tag_id = tg.id
          JOIN transactions t ON t.id = tt.transaction_id
          WHERE tg.user_id = ? AND t.user_id = ?
          GROUP BY tg.id
          ORDER BY usage_count DESC, tg.name ASC
          LIMIT 200
        `
      )
      .all(req.userId, req.userId)
      .map((row) => ({ name: row.name, usage_count: Number(row.usage_count) }));
    res.json(rows);
  });

  app.post("/api/v1/ai/providers", (req, res) => {
    const schema = z.object({
      provider_type: z.string().min(1).max(32).default("openai_compatible"),
      display_name: z.string().min(1).max(64),
      base_url: z.string().url(),
      model: z.string().min(1).max(128),
      api_key: z.string().min(8).max(400)
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const payload = parsed.data;
    const encrypted = encryptText(payload.api_key);
    const last4 = payload.api_key.slice(-4);
    const result = db
      .prepare(
        `
          INSERT INTO ai_provider_credentials (
            user_id, provider_type, display_name, base_url, model, encrypted_api_key, key_last4, active
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 1)
        `
      )
      .run(
        req.userId,
        payload.provider_type,
        payload.display_name,
        payload.base_url,
        payload.model,
        encrypted,
        last4
      );
    const providerId = Number(result.lastInsertRowid);
    const settings = getUserSettings(db, req.userId);
    if (!settings.default_ai_provider_id) {
      db.prepare(
        `
          UPDATE user_settings
          SET default_ai_provider_id = ?, updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ?
        `
      ).run(providerId, req.userId);
    }
    logEvent(db, req.userId, "ai_provider_created", {
      provider_type: payload.provider_type
    });
    const created = getProviderPublicView(db, req.userId, providerId);
    res.status(201).json(
      created || {
        id: providerId,
        provider_type: payload.provider_type,
        display_name: payload.display_name,
        base_url: payload.base_url,
        model: payload.model,
        key_masked: `****${last4}`,
        is_default: !settings.default_ai_provider_id
      }
    );
  });

  app.get("/api/v1/ai/providers", (req, res) => {
    const settings = getUserSettings(db, req.userId);
    const rows = db
      .prepare(
        `
          SELECT id, provider_type, display_name, base_url, model, key_last4, active, created_at, updated_at
          FROM ai_provider_credentials
          WHERE user_id = ? AND active = 1
          ORDER BY id DESC
        `
      )
      .all(req.userId)
      .map((row) => ({
        ...row,
        key_masked: `****${row.key_last4}`,
        is_default: settings.default_ai_provider_id === row.id
      }));
    res.json(rows);
  });

  app.patch("/api/v1/ai/providers/:id", (req, res) => {
    const providerId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(providerId) || providerId <= 0) {
      return res.status(400).json({ error: "Invalid provider id." });
    }
    const schema = z.object({
      display_name: z.string().min(1).max(64).optional(),
      base_url: z.string().url().optional(),
      model: z.string().min(1).max(128).optional(),
      api_key: z.string().min(8).max(400).optional(),
      active: z.boolean().optional()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const payload = parsed.data;
    const provider = getProviderInternal(db, req.userId, providerId);
    if (!provider) {
      return res.status(404).json({ error: "Provider not found." });
    }

    db.prepare(
      `
        UPDATE ai_provider_credentials
        SET
          display_name = ?,
          base_url = ?,
          model = ?,
          encrypted_api_key = ?,
          key_last4 = ?,
          active = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `
    ).run(
      payload.display_name || provider.display_name,
      payload.base_url || provider.base_url,
      payload.model || provider.model,
      payload.api_key ? encryptText(payload.api_key) : provider.encrypted_api_key,
      payload.api_key ? payload.api_key.slice(-4) : provider.key_last4,
      payload.active === undefined ? provider.active : payload.active ? 1 : 0,
      providerId,
      req.userId
    );
    res.json(getProviderPublicView(db, req.userId, providerId));
  });

  app.delete("/api/v1/ai/providers/:id", (req, res) => {
    const providerId = Number.parseInt(req.params.id, 10);
    const provider = getProviderInternal(db, req.userId, providerId);
    if (!provider) {
      return res.status(404).json({ error: "Provider not found." });
    }
    db.prepare(
      "UPDATE ai_provider_credentials SET active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?"
    ).run(providerId, req.userId);
    const settings = getUserSettings(db, req.userId);
    if (settings.default_ai_provider_id === providerId) {
      db.prepare(
        "UPDATE user_settings SET default_ai_provider_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?"
      ).run(req.userId);
    }
    res.json({ ok: true });
  });

  app.post("/api/v1/ai/providers/:id/validate", async (req, res) => {
    const providerId = Number.parseInt(req.params.id, 10);
    const provider = getProviderInternal(db, req.userId, providerId);
    if (!provider || !provider.active) {
      return res.status(404).json({ error: "Provider not found." });
    }
    const categories = getCategoriesMap(db, req.userId);
    const accounts = getAccounts(db, req.userId);
    try {
      await buildExtractionDraft({
        provider,
        text: "Lunch 12 USD at 7-Eleven",
        categories,
        accounts,
        mode: "provider_only"
      });
      res.json({
        ok: true,
        fallback_used: false,
        error_message: ""
      });
    } catch (error) {
      res.status(502).json({
        ok: false,
        error: String(error.message || "Provider validation failed.")
      });
    }
  });

  app.post("/api/v1/ai/providers/:id/set-default", (req, res) => {
    const providerId = Number.parseInt(req.params.id, 10);
    const provider = getProviderInternal(db, req.userId, providerId);
    if (!provider || !provider.active) {
      return res.status(404).json({ error: "Provider not found." });
    }
    db.prepare(
      "UPDATE user_settings SET default_ai_provider_id = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?"
    ).run(providerId, req.userId);
    res.json({ ok: true, default_ai_provider_id: providerId });
  });

  app.post("/api/v1/transactions/parse-text", async (req, res) => {
    const schema = z.object({
      text: z.string().min(1).max(2000),
      provider_id: z.number().int().positive().optional()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const input = parsed.data;
    const provider = resolveProviderForUser(db, req.userId, input.provider_id);
    if (!provider) {
      return res.status(400).json({
        error: "No active AI provider configured. Create and set a default provider first."
      });
    }
    const categories = getCategoriesMap(db, req.userId);
    const accounts = getAccounts(db, req.userId);
    let extraction;
    try {
      extraction = await buildExtractionDraft({
        provider,
        text: input.text,
        imageBase64: null,
        categories,
        accounts,
        mode: "provider_only"
      });
    } catch (error) {
      return res.status(502).json({
        error: String(error.message || "AI parsing failed.")
      });
    }
    const draft = await enrichDraftWithFx(db, req.userId, extraction.draft);
    const record = insertExtraction(db, req.userId, {
      source_type: "text",
      raw_text: input.text,
      raw_image_base64: "",
      draft,
      provider_credential_id: provider ? provider.id : null,
      error_message: extraction.error_message || ""
    });
    logEvent(db, req.userId, "capture_text_parsed", {
      fallback_used: extraction.fallback_used
    });
    res.status(201).json({
      extraction_id: record.id,
      draft,
      fallback_used: extraction.fallback_used,
      error_message: extraction.error_message || ""
    });
  });

  app.post("/api/v1/transactions/parse-image", async (req, res) => {
    const schema = z.object({
      ocr_text: z.string().max(10000).optional(),
      image_base64: z.string().max(5000000).optional(),
      provider_id: z.number().int().positive().optional()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const input = parsed.data;
    if ((!input.ocr_text || !String(input.ocr_text).trim()) && !input.image_base64) {
      return res.status(400).json({ error: "ocr_text or image_base64 is required." });
    }
    const provider = resolveProviderForUser(db, req.userId, input.provider_id);
    if (!provider) {
      return res.status(400).json({
        error: "No active AI provider configured. Create and set a default provider first."
      });
    }
    const categories = getCategoriesMap(db, req.userId);
    const accounts = getAccounts(db, req.userId);
    const text = input.ocr_text || "";
    let extraction;
    try {
      extraction = await buildExtractionDraft({
        provider,
        text,
        imageBase64: input.image_base64 || null,
        categories,
        accounts,
        mode: "provider_only"
      });
    } catch (error) {
      return res.status(502).json({
        error: String(error.message || "AI image parsing failed.")
      });
    }
    const draft = await enrichDraftWithFx(db, req.userId, extraction.draft);
    const record = insertExtraction(db, req.userId, {
      source_type: "image",
      raw_text: text,
      raw_image_base64: input.image_base64 || "",
      draft,
      provider_credential_id: provider ? provider.id : null,
      error_message: extraction.error_message || ""
    });
    logEvent(db, req.userId, "capture_image_parsed", {
      fallback_used: extraction.fallback_used
    });
    res.status(201).json({
      extraction_id: record.id,
      draft,
      fallback_used: extraction.fallback_used,
      error_message: extraction.error_message || ""
    });
  });

  app.post("/api/v1/transactions/confirm-extraction", async (req, res) => {
    const schema = z.object({
      extraction_id: z.number().int().positive(),
      overrides: z.record(z.any()).optional()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const extractionId = parsed.data.extraction_id;
    const row = db
      .prepare("SELECT * FROM ai_extractions WHERE id = ? AND user_id = ?")
      .get(extractionId, req.userId);
    if (!row) {
      return res.status(404).json({ error: "Extraction not found." });
    }
    const draft = JSON.parse(row.draft_json);
    const merged = { ...draft, ...(parsed.data.overrides || {}) };
    if (typeof merged.tags === "string") {
      merged.tags = merged.tags
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
    }
    const payload = await enrichDraftWithFx(db, req.userId, merged);
    let transaction;
    try {
      transaction = createTransactionRecord(db, req.userId, payload);
    } catch (error) {
      return res.status(400).json({ error: String(error.message || "Invalid extraction payload.") });
    }
    db.prepare(
      `
        UPDATE ai_extractions
        SET status = 'confirmed', updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `
    ).run(extractionId, req.userId);
    logEvent(db, req.userId, "extraction_confirmed", {
      extraction_id: extractionId,
      transaction_id: transaction.id
    });
    res.status(201).json(transaction);
  });

  app.post("/api/v1/transactions", async (req, res) => {
    const schema = z.object({
      date: z.string().min(10).max(10),
      type: z.enum(TRANSACTION_TYPES),
      amount_original: z.number().positive(),
      currency_original: z.string().min(3).max(8),
      fx_rate: z.number().positive().optional(),
      amount_base: z.number().positive().optional(),
      category_l1: z.string().min(1).max(64).optional(),
      category_l2: z.string().min(1).max(64).optional(),
      account_from_id: z.number().int().positive().optional(),
      account_to_id: z.number().int().positive().optional(),
      transfer_reason: z.enum(TRANSFER_REASONS).optional(),
      note: z.string().max(500).optional(),
      tags: z.array(z.string().min(1).max(64)).max(20).optional()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    let txInput = parsed.data;
    try {
      txInput = {
        ...parsed.data,
        currency_original: normalizeSupportedCurrency(parsed.data.currency_original, "currency_original")
      };
    } catch (error) {
      return res.status(400).json({ error: String(error.message || "Invalid currency_original.") });
    }
    const enriched = await enrichDraftWithFx(db, req.userId, txInput);
    let tx;
    try {
      tx = createTransactionRecord(db, req.userId, enriched);
    } catch (error) {
      return res.status(400).json({ error: String(error.message || "Invalid transaction.") });
    }
    logEvent(db, req.userId, "transaction_created", {
      transaction_id: tx.id,
      type: tx.type
    });
    res.status(201).json(tx);
  });

  app.get("/api/v1/transactions", (req, res) => {
    const baseCurrency = getUserSettings(db, req.userId).base_currency;
    const start = normalizeDate(req.query.start);
    const end = normalizeDate(req.query.end);
    const hasRange = Boolean(start || end);
    const month = hasRange ? null : normalizeMonth(req.query.month);
    const params = hasRange ? [req.userId] : [req.userId, month];
    const filters = hasRange ? ["t.user_id = ?"] : ["t.user_id = ?", "substr(t.tx_date, 1, 7) = ?"];
    if (start) {
      filters.push("t.tx_date >= ?");
      params.push(start);
    }
    if (end) {
      filters.push("t.tx_date <= ?");
      params.push(end);
    }
    if (req.query.type) {
      filters.push("t.type = ?");
      params.push(req.query.type);
    }
    if (req.query.category_l1) {
      filters.push("t.category_l1 = ?");
      params.push(req.query.category_l1);
    }
    if (req.query.tag) {
      filters.push(
        `
          EXISTS (
            SELECT 1
            FROM transaction_tags tt2
            JOIN tags tg2 ON tg2.id = tt2.tag_id
            WHERE tt2.transaction_id = t.id AND tg2.name = ?
          )
        `
      );
      params.push(req.query.tag);
    }
    const sql = `
      SELECT t.*, GROUP_CONCAT(tg.name, '|') AS tag_names
      FROM transactions t
      LEFT JOIN transaction_tags tt ON tt.transaction_id = t.id
      LEFT JOIN tags tg ON tg.id = tt.tag_id
      WHERE ${filters.join(" AND ")}
      GROUP BY t.id
      ORDER BY t.tx_date DESC, t.id DESC
    `;
    const rows = db.prepare(sql).all(...params).map((row) => ({
      ...row,
      amount_base_snapshot: Number(row.amount_base),
      amount_base: convertCurrency(
        Number(row.amount_original || 0),
        normalizeCurrency(row.currency_original || baseCurrency),
        baseCurrency
      ),
      base_currency: baseCurrency,
      tags: row.tag_names ? row.tag_names.split("|") : []
    }));
    res.json(rows);
  });

  app.post("/api/v1/budgets", (req, res) => {
    const schema = z.object({
      month: z.string().min(7).max(7),
      category_l1: z.string().min(1).max(64),
      total_amount: z.number().positive()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const payload = parsed.data;
    if (!isActiveL1(db, req.userId, payload.category_l1)) {
      return res.status(400).json({ error: "Budget category_l1 must be active." });
    }
    db.prepare(
      `
        INSERT INTO budgets (user_id, month, category_l1, total_amount)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id, month, category_l1)
        DO UPDATE SET total_amount = excluded.total_amount
      `
    ).run(req.userId, payload.month, payload.category_l1, payload.total_amount);
    logEvent(db, req.userId, "budget_monthly_upserted", {
      month: payload.month,
      category_l1: payload.category_l1
    });
    res.status(201).json(payload);
  });

  app.get("/api/v1/budgets", (req, res) => {
    const month = normalizeMonth(req.query.month);
    const baseCurrency = getUserSettings(db, req.userId).base_currency;
    const expenses = db
      .prepare(
        `
          SELECT category_l1, amount_original, currency_original
          FROM transactions
          WHERE user_id = ? AND type = 'expense' AND substr(tx_date, 1, 7) = ?
        `
      )
      .all(req.userId, month);
    const spentByCategory = new Map();
    for (const tx of expenses) {
      const spent = convertCurrency(
        Number(tx.amount_original || 0),
        normalizeCurrency(tx.currency_original || baseCurrency),
        baseCurrency
      );
      spentByCategory.set(tx.category_l1, (spentByCategory.get(tx.category_l1) || 0) + spent);
    }
    const rows = db
      .prepare(
        `
          SELECT b.month, b.category_l1, b.total_amount
          FROM budgets b
          WHERE b.user_id = ? AND b.month = ?
          ORDER BY b.category_l1
        `
      )
      .all(req.userId, month)
      .map((row) =>
        enrichBudgetRow({
          ...row,
          spent_amount: Number(spentByCategory.get(row.category_l1) || 0)
        })
      );
    res.json(rows);
  });

  app.post("/api/v1/budgets/yearly", (req, res) => {
    const schema = z.object({
      year: z.number().int().min(2000).max(2100),
      category_l1: z.string().min(1).max(64),
      total_amount: z.number().positive()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const payload = parsed.data;
    if (!isActiveL1(db, req.userId, payload.category_l1)) {
      return res.status(400).json({ error: "Yearly budget category_l1 must be active." });
    }
    db.prepare(
      `
        INSERT INTO yearly_budgets (user_id, year, category_l1, total_amount)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id, year, category_l1)
        DO UPDATE SET total_amount = excluded.total_amount
      `
    ).run(req.userId, payload.year, payload.category_l1, payload.total_amount);
    logEvent(db, req.userId, "budget_yearly_upserted", {
      year: payload.year,
      category_l1: payload.category_l1
    });
    res.status(201).json(payload);
  });

  app.get("/api/v1/budgets/yearly", (req, res) => {
    const year =
      Number.parseInt(req.query.year, 10) || Number.parseInt(new Date().toISOString().slice(0, 4), 10);
    const baseCurrency = getUserSettings(db, req.userId).base_currency;
    const expenses = db
      .prepare(
        `
          SELECT category_l1, amount_original, currency_original
          FROM transactions
          WHERE user_id = ? AND type = 'expense' AND substr(tx_date, 1, 4) = ?
        `
      )
      .all(req.userId, String(year));
    const spentByCategory = new Map();
    for (const tx of expenses) {
      const spent = convertCurrency(
        Number(tx.amount_original || 0),
        normalizeCurrency(tx.currency_original || baseCurrency),
        baseCurrency
      );
      spentByCategory.set(tx.category_l1, (spentByCategory.get(tx.category_l1) || 0) + spent);
    }
    const rows = db
      .prepare(
        `
          SELECT y.year, y.category_l1, y.total_amount
          FROM yearly_budgets y
          WHERE y.user_id = ? AND y.year = ?
          ORDER BY y.category_l1
        `
      )
      .all(req.userId, year)
      .map((row) => ({
        year: row.year,
        ...enrichBudgetRow({
          ...row,
          spent_amount: Number(spentByCategory.get(row.category_l1) || 0)
        })
      }));
    res.json(rows);
  });

  app.get("/api/v1/dashboard", (req, res) => {
    const month = normalizeMonth(req.query.month);
    const settings = getUserSettings(db, req.userId);
    const dashboard = buildDashboardPayload(db, req.userId, month, settings.base_currency);
    res.json(dashboard);
  });

  app.get("/api/v1/metrics/runway", (req, res) => {
    const month = normalizeMonth(req.query.month);
    const dashboard = buildDashboardPayload(db, req.userId, month, getUserSettings(db, req.userId).base_currency);
    res.json({
      month,
      liquid_cash: dashboard.liquid_cash,
      burn_rate: dashboard.burn_rate,
      runway_months: dashboard.runway_months
    });
  });

  app.get("/api/v1/metrics/risk", (req, res) => {
    const month = normalizeMonth(req.query.month);
    res.json(buildRiskPayload(db, req.userId, month));
  });

  app.get("/api/v1/reviews/monthly", (req, res) => {
    const month = normalizeMonth(req.query.month);
    const currentBase = getUserSettings(db, req.userId).base_currency;
    logEvent(db, req.userId, "monthly_review_opened", { month });
    const snapshot = db
      .prepare(
        "SELECT payload_json, summary, created_at FROM monthly_review_snapshots WHERE user_id = ? AND month = ?"
      )
      .get(req.userId, month);
    if (snapshot) {
      const payload = JSON.parse(snapshot.payload_json);
      if (payload.base_currency === currentBase) {
        return res.json({
          ...payload,
          summary: snapshot.summary,
          source: "snapshot",
          created_at: snapshot.created_at
        });
      }
    }
    const payload = buildMonthlyReviewPayload(db, req.userId, month, currentBase);
    return res.json({ ...payload, source: "live" });
  });

  app.post("/api/v1/reviews/monthly/generate", (req, res) => {
    const schema = z.object({ month: z.string().min(7).max(7).optional() });
    const parsed = schema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const month = normalizeMonth(parsed.data.month);
    const payload = buildMonthlyReviewPayload(
      db,
      req.userId,
      month,
      getUserSettings(db, req.userId).base_currency
    );
    db.prepare(
      `
        INSERT INTO monthly_review_snapshots (user_id, month, payload_json, summary)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id, month)
        DO UPDATE SET payload_json = excluded.payload_json, summary = excluded.summary, created_at = CURRENT_TIMESTAMP
      `
    ).run(req.userId, month, JSON.stringify(payload), payload.summary);
    logEvent(db, req.userId, "monthly_review_generated", { month });
    res.status(201).json({ ...payload, source: "generated" });
  });

  app.get("/api/v1/analytics/summary", (req, res) => {
    const month = normalizeMonth(req.query.month);
    const rows = db
      .prepare(
        `
          SELECT event_name, COUNT(*) AS count
          FROM product_events
          WHERE user_id = ? AND event_month = ?
          GROUP BY event_name
        `
      )
      .all(req.userId, month);
    const byEvent = {};
    for (const row of rows) {
      byEvent[row.event_name] = Number(row.count);
    }
    res.json({
      month,
      events: byEvent,
      weekly_recording_frequency: byEvent.transaction_created
        ? Number((byEvent.transaction_created / 4).toFixed(2))
        : 0
    });
  });

  app.get("/api/v1/export/transactions.csv", (req, res) => {
    const month = normalizeMonth(req.query.month);
    const rows = db
      .prepare(
        `
          SELECT tx_date, type, amount_original, currency_original, fx_rate, amount_base,
                 category_l1, category_l2, account_from_id, account_to_id, transfer_reason, note, created_at
          FROM transactions
          WHERE user_id = ? AND substr(tx_date, 1, 7) = ?
          ORDER BY tx_date DESC, id DESC
        `
      )
      .all(req.userId, month);
    const header = [
      "tx_date",
      "type",
      "amount_original",
      "currency_original",
      "fx_rate",
      "amount_base",
      "category_l1",
      "category_l2",
      "account_from_id",
      "account_to_id",
      "transfer_reason",
      "note",
      "created_at"
    ];
    const csvLines = [header.join(",")];
    for (const row of rows) {
      const line = header
        .map((key) => `"${String(row[key] ?? "").replaceAll('"', '""')}"`)
        .join(",");
      csvLines.push(line);
    }
    const filename = `transactions-${month}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(csvLines.join("\n"));
  });

  app.use((error, _req, res, _next) => {
    console.error(error);
    res.status(500).json({ error: "Internal server error." });
  });

  return app;
}

function getUserSettings(db, userId) {
  const row = db
    .prepare(
      "SELECT user_id, base_currency, timezone, ui_language, default_ai_provider_id FROM user_settings WHERE user_id = ?"
    )
    .get(userId);
  if (!row) {
    ensureUserAndSeedDefaults(db, userId);
    return getUserSettings(db, userId);
  }
  const normalizedBase = normalizeCurrency(row.base_currency || "USD");
  return {
    user_id: row.user_id,
    base_currency: SUPPORTED_CURRENCIES.includes(normalizedBase) ? normalizedBase : "USD",
    timezone: row.timezone || "UTC",
    ui_language: row.ui_language === "zh" ? "zh" : "en",
    default_ai_provider_id: row.default_ai_provider_id || null
  };
}

function getAccounts(db, userId) {
  return db
    .prepare("SELECT * FROM accounts WHERE user_id = ? ORDER BY id")
    .all(userId);
}

function getCategoriesMap(db, userId) {
  const l1Rows = db
    .prepare(
      `
        SELECT id, name, active, is_default
        FROM expense_category_l1
        WHERE user_id = ?
        ORDER BY name
      `
    )
    .all(userId);
  const l2Rows = db
    .prepare(
      `
        SELECT c2.name, c2.active, c2.is_default, c1.name AS l1_name
        FROM expense_category_l2 c2
        JOIN expense_category_l1 c1 ON c1.id = c2.l1_id
        WHERE c2.user_id = ?
        ORDER BY c1.name, c2.name
      `
    )
    .all(userId);
  const map = {};
  for (const row of l1Rows) {
    map[row.name] = {
      active: Boolean(row.active),
      is_default: Boolean(row.is_default),
      l2: []
    };
  }
  for (const row of l2Rows) {
    if (map[row.l1_name]) {
      map[row.l1_name].l2.push({
        name: row.name,
        active: Boolean(row.active),
        is_default: Boolean(row.is_default)
      });
    }
  }
  if (Object.keys(map).length === 0) {
    for (const [l1, l2List] of Object.entries(DEFAULT_EXPENSE_CATEGORIES)) {
      map[l1] = { active: true, is_default: true, l2: l2List.map((name) => ({ name, active: true, is_default: true })) };
    }
  }
  return map;
}

function isActiveL1(db, userId, categoryL1) {
  const row = db
    .prepare("SELECT id FROM expense_category_l1 WHERE user_id = ? AND name = ? AND active = 1")
    .get(userId, categoryL1);
  return Boolean(row);
}

function getProviderInternal(db, userId, providerId) {
  return db
    .prepare("SELECT * FROM ai_provider_credentials WHERE user_id = ? AND id = ?")
    .get(userId, providerId);
}

function getProviderPublicView(db, userId, providerId) {
  const settings = getUserSettings(db, userId);
  const row = db
    .prepare(
      `
        SELECT id, provider_type, display_name, base_url, model, key_last4, active, created_at, updated_at
        FROM ai_provider_credentials
        WHERE user_id = ? AND id = ?
      `
    )
    .get(userId, providerId);
  if (!row) return null;
  return {
    ...row,
    key_masked: `****${row.key_last4}`,
    is_default: settings.default_ai_provider_id === row.id
  };
}

function resolveProviderForUser(db, userId, requestedProviderId) {
  let providerId = requestedProviderId;
  if (!providerId) {
    providerId = getUserSettings(db, userId).default_ai_provider_id;
  }
  if (!providerId) return null;
  const provider = getProviderInternal(db, userId, providerId);
  if (!provider || !provider.active) return null;
  return provider;
}

async function enrichDraftWithFx(db, userId, payload) {
  const settings = getUserSettings(db, userId);
  const normalized = {
    ...payload,
    date: payload.date || new Date().toISOString().slice(0, 10),
    currency_original: normalizeCurrency(payload.currency_original || settings.base_currency)
  };
  const amountOriginal = Number(normalized.amount_original || 0);
  if (!Number.isFinite(amountOriginal) || amountOriginal <= 0) {
    return {
      ...normalized,
      amount_original: amountOriginal,
      fx_rate: Number(normalized.fx_rate || 1),
      amount_base: Number(normalized.amount_base || 0)
    };
  }

  let fxRate = Number(normalized.fx_rate || 0);
  let fxSource = "provided";
  if (!Number.isFinite(fxRate) || fxRate <= 0) {
    const quote = await fetchFxRate(normalized.currency_original, settings.base_currency);
    fxRate = quote.rate;
    fxSource = quote.source;
  }

  const amountBase =
    Number.isFinite(Number(normalized.amount_base)) && Number(normalized.amount_base) > 0
      ? Number(normalized.amount_base)
      : Number((amountOriginal * fxRate).toFixed(8));

  return {
    ...normalized,
    amount_original: amountOriginal,
    fx_rate: fxRate,
    amount_base: amountBase,
    fx_source: fxSource,
    base_currency: settings.base_currency
  };
}

function createTransactionRecord(db, userId, payload) {
  const type = payload.type;
  if (!TRANSACTION_TYPES.includes(type)) {
    throw new Error("Unsupported transaction type.");
  }
  const amountOriginal = Number(payload.amount_original);
  const fxRate = Number(payload.fx_rate);
  const amountBase = Number(payload.amount_base);
  if (!Number.isFinite(amountOriginal) || amountOriginal <= 0) {
    throw new Error("Invalid amount_original.");
  }
  if (!Number.isFinite(fxRate) || fxRate <= 0) {
    throw new Error("Invalid fx_rate.");
  }
  if (!Number.isFinite(amountBase) || amountBase <= 0) {
    throw new Error("Invalid amount_base.");
  }
  const sourceCurrency = normalizeSupportedCurrency(payload.currency_original, "currency_original");

  const from =
    payload.account_from_id !== undefined
      ? db
          .prepare("SELECT * FROM accounts WHERE id = ? AND user_id = ?")
          .get(payload.account_from_id, userId)
      : null;
  const to =
    payload.account_to_id !== undefined
      ? db
          .prepare("SELECT * FROM accounts WHERE id = ? AND user_id = ?")
          .get(payload.account_to_id, userId)
      : null;

  if (payload.account_from_id !== undefined && !from) {
    throw new Error("account_from_id not found for user.");
  }
  if (payload.account_to_id !== undefined && !to) {
    throw new Error("account_to_id not found for user.");
  }

  if (type === "expense") {
    if (!from) throw new Error("Expense requires account_from_id.");
    if (!payload.category_l1 || !payload.category_l2) {
      throw new Error("Expense requires category_l1 and category_l2.");
    }
    const row = db
      .prepare(
        `
          SELECT c2.id
          FROM expense_category_l2 c2
          JOIN expense_category_l1 c1 ON c1.id = c2.l1_id
          WHERE c1.user_id = ?
            AND c1.active = 1
            AND c2.active = 1
            AND c1.name = ?
            AND c2.name = ?
        `
      )
      .get(userId, payload.category_l1, payload.category_l2);
    if (!row) {
      throw new Error("Invalid active expense category pair.");
    }
  }

  if (type === "income" && !to) {
    throw new Error("Income requires account_to_id.");
  }

  const transferReason = payload.transfer_reason || "normal";
  if (type === "transfer") {
    if (!from || !to) {
      throw new Error("Transfer requires account_from_id and account_to_id.");
    }
    if (from.id === to.id) {
      throw new Error("Transfer requires different source and target accounts.");
    }
    if (transferReason === "deposit_lock" && to.type !== "restricted_cash") {
      throw new Error("deposit_lock requires destination account type restricted_cash.");
    }
    if (transferReason === "deposit_release" && from.type !== "restricted_cash") {
      throw new Error("deposit_release requires source account type restricted_cash.");
    }
  }

  const tags = [...new Set((payload.tags || []).map((x) => String(x).trim()).filter(Boolean))];
  const insertTx = db.prepare(
    `
      INSERT INTO transactions (
        user_id, tx_date, type, amount_original, currency_original, fx_rate, amount_base,
        category_l1, category_l2, account_from_id, account_to_id, transfer_reason, note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
  );
  const updateBalance = db.prepare(
    "UPDATE accounts SET balance = balance + ? WHERE id = ? AND user_id = ?"
  );
  const insertTag = db.prepare(
    "INSERT INTO tags (user_id, name) VALUES (?, ?) ON CONFLICT(user_id, name) DO NOTHING"
  );
  const getTag = db.prepare("SELECT id FROM tags WHERE user_id = ? AND name = ?");
  const attachTag = db.prepare(
    "INSERT OR IGNORE INTO transaction_tags (transaction_id, tag_id) VALUES (?, ?)"
  );

  const txn = db.transaction(() => {
    const result = insertTx.run(
      userId,
      payload.date,
      type,
      amountOriginal,
      sourceCurrency,
      fxRate,
      amountBase,
      type === "expense" ? payload.category_l1 : null,
      type === "expense" ? payload.category_l2 : null,
      from ? from.id : null,
      to ? to.id : null,
      type === "transfer" ? transferReason : null,
      payload.note || ""
    );
    const txId = Number(result.lastInsertRowid);
    if (type === "expense") {
      const deltaFrom = convertCurrency(
        amountOriginal,
        sourceCurrency,
        normalizeCurrency(from.currency)
      );
      updateBalance.run(-deltaFrom, from.id, userId);
    } else if (type === "income") {
      const deltaTo = convertCurrency(
        amountOriginal,
        sourceCurrency,
        normalizeCurrency(to.currency)
      );
      updateBalance.run(deltaTo, to.id, userId);
    } else if (type === "transfer") {
      const deltaFrom = convertCurrency(
        amountOriginal,
        sourceCurrency,
        normalizeCurrency(from.currency)
      );
      const deltaTo = convertCurrency(
        amountOriginal,
        sourceCurrency,
        normalizeCurrency(to.currency)
      );
      updateBalance.run(-deltaFrom, from.id, userId);
      updateBalance.run(deltaTo, to.id, userId);
    }
    for (const tag of tags) {
      insertTag.run(userId, tag);
      const tagRow = getTag.get(userId, tag);
      attachTag.run(txId, tagRow.id);
    }
    return txId;
  });

  const txId = txn();
  return getTransactionWithTags(db, userId, txId);
}

function insertExtraction(db, userId, payload) {
  const result = db
    .prepare(
      `
        INSERT INTO ai_extractions (
          user_id, source_type, raw_text, raw_image_base64, draft_json, status, provider_credential_id, error_message
        ) VALUES (?, ?, ?, ?, ?, 'draft', ?, ?)
      `
    )
    .run(
      userId,
      payload.source_type,
      payload.raw_text || "",
      payload.raw_image_base64 || "",
      JSON.stringify(payload.draft),
      payload.provider_credential_id,
      payload.error_message || ""
    );
  return db
    .prepare("SELECT id, source_type, status, created_at FROM ai_extractions WHERE id = ?")
    .get(Number(result.lastInsertRowid));
}

function logEvent(db, userId, eventName, payload = {}) {
  const month = new Date().toISOString().slice(0, 7);
  db.prepare(
    `
      INSERT INTO product_events (user_id, event_name, event_month, payload_json)
      VALUES (?, ?, ?, ?)
    `
  ).run(userId, eventName, month, JSON.stringify(payload));
}

function buildDashboardPayload(db, userId, month, baseCurrency) {
  const accountRows = db
    .prepare("SELECT id, name, balance, currency, type FROM accounts WHERE user_id = ?")
    .all(userId);
  let netWorth = 0;
  let liquidCash = 0;
  let restrictedCashTotal = 0;
  const accountComposition = [];
  for (const account of accountRows) {
    const valueBase = convertCurrency(
      Number(account.balance),
      normalizeCurrency(account.currency),
      baseCurrency
    );
    netWorth += valueBase;
    accountComposition.push({
      account_id: account.id,
      name: account.name,
      type: account.type,
      amount_base: Number(valueBase.toFixed(2))
    });
    if (account.type === "restricted_cash") {
      restrictedCashTotal += valueBase;
    } else {
      liquidCash += valueBase;
    }
  }
  const monthRows = db
    .prepare(
      `
        SELECT type, amount_original, currency_original, category_l1
        FROM transactions
        WHERE user_id = ? AND substr(tx_date, 1, 7) = ?
      `
    )
    .all(userId, month);
  let monthlyIncome = 0;
  let monthlyExpense = 0;
  const spentByCategory = new Map();
  for (const tx of monthRows) {
    const converted = convertCurrency(
      Number(tx.amount_original || 0),
      normalizeCurrency(tx.currency_original || baseCurrency),
      baseCurrency
    );
    if (tx.type === "income") {
      monthlyIncome += converted;
    } else if (tx.type === "expense") {
      monthlyExpense += converted;
      spentByCategory.set(tx.category_l1, (spentByCategory.get(tx.category_l1) || 0) + converted);
    }
  }

  const budgetRows = db
    .prepare(
      `
        SELECT category_l1, total_amount
        FROM budgets
        WHERE user_id = ? AND month = ?
        ORDER BY category_l1
      `
    )
    .all(userId, month);
  const budgetStatus = budgetRows.map((row) => {
    const spent = Number(spentByCategory.get(row.category_l1) || 0);
    const total = Number(row.total_amount);
    return {
      category_l1: row.category_l1,
      total_amount: total,
      spent_amount: spent,
      remaining_amount: total - spent,
      overspend: spent > total
    };
  });

  const burnRate = computeBurnRate(db, userId, baseCurrency);
  const runway = burnRate > 0 ? Number((liquidCash / burnRate).toFixed(2)) : null;

  return {
    month,
    base_currency: baseCurrency,
    net_worth: netWorth,
    liquid_cash: liquidCash,
    restricted_cash_total: restrictedCashTotal,
    account_composition: accountComposition,
    monthly_income: monthlyIncome,
    monthly_expense: monthlyExpense,
    net_cash_flow: monthlyIncome - monthlyExpense,
    burn_rate: Number(burnRate.toFixed(2)),
    runway_months: runway,
    budget_status: budgetStatus
  };
}

function computeBurnRate(db, userId, baseCurrency) {
  const rows = db
    .prepare(
      `
        SELECT substr(tx_date, 1, 7) AS month, type, amount_original, currency_original
        FROM transactions
        WHERE user_id = ? AND type IN ('income', 'expense')
        ORDER BY month DESC
      `
    )
    .all(userId);
  if (!rows.length) return 0;
  const byMonth = new Map();
  for (const row of rows) {
    const current = byMonth.get(row.month) || { income: 0, expense: 0 };
    const converted = convertCurrency(
      Number(row.amount_original || 0),
      normalizeCurrency(row.currency_original || baseCurrency),
      baseCurrency
    );
    if (row.type === "income") {
      current.income += converted;
    } else if (row.type === "expense") {
      current.expense += converted;
    }
    byMonth.set(row.month, current);
  }
  const months = [...byMonth.keys()].sort((a, b) => b.localeCompare(a)).slice(0, 3);
  const burns = months.map((month) => {
    const row = byMonth.get(month);
    return Math.max(0, row.expense - row.income);
  });
  return burns.reduce((sum, value) => sum + value, 0) / burns.length;
}

function buildRiskPayload(db, userId, month) {
  const baseCurrency = getUserSettings(db, userId).base_currency;
  const accountRows = db
    .prepare("SELECT balance, currency, type FROM accounts WHERE user_id = ?")
    .all(userId);
  let netWorth = 0;
  let positiveAssetValue = 0;
  let cryptoPositiveAssetValue = 0;
  for (const account of accountRows) {
    const valueBase = convertCurrency(
      Number(account.balance),
      normalizeCurrency(account.currency),
      baseCurrency
    );
    netWorth += valueBase;
    if (valueBase > 0) {
      positiveAssetValue += valueBase;
      if (account.type === "crypto_wallet" || account.type === "exchange") {
        cryptoPositiveAssetValue += valueBase;
      }
    }
  }

  let cryptoExposure = 0;
  if (positiveAssetValue > 0) {
    cryptoExposure = cryptoPositiveAssetValue / positiveAssetValue;
    cryptoExposure = Math.min(1, Math.max(0, cryptoExposure));
  }

  const rawCryptoOverNetWorth =
    netWorth !== 0 ? Number((cryptoPositiveAssetValue / Math.abs(netWorth)).toFixed(4)) : 0;

  const incomeTxRows = db
    .prepare(
      `
        SELECT substr(tx_date, 1, 7) AS month, amount_original, currency_original
        FROM transactions
        WHERE user_id = ? AND type = 'income'
      `
    )
    .all(userId);
  const incomeByMonth = new Map();
  for (const row of incomeTxRows) {
    const converted = convertCurrency(
      Number(row.amount_original || 0),
      normalizeCurrency(row.currency_original || baseCurrency),
      baseCurrency
    );
    incomeByMonth.set(row.month, (incomeByMonth.get(row.month) || 0) + converted);
  }
  const incomeRows = [...incomeByMonth.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 6)
    .map(([, value]) => value);
  const avgIncome =
    incomeRows.length > 0
      ? incomeRows.reduce((sum, value) => sum + value, 0) / incomeRows.length
      : 0;
  const variance =
    incomeRows.length > 0
      ? incomeRows.reduce((sum, value) => sum + (value - avgIncome) ** 2, 0) / incomeRows.length
      : 0;
  const incomeVolatility = avgIncome > 0 ? Math.sqrt(variance) / avgIncome : 0;

  const expenseRows = db
    .prepare(
      `
        SELECT category_l2, amount_original, currency_original
        FROM transactions
        WHERE user_id = ? AND type = 'expense' AND substr(tx_date, 1, 7) = ?
      `
    )
    .all(userId, month);
  let fixedCostInMonth = 0;
  let totalExpenseInMonth = 0;
  for (const row of expenseRows) {
    const converted = convertCurrency(
      Number(row.amount_original || 0),
      normalizeCurrency(row.currency_original || baseCurrency),
      baseCurrency
    );
    totalExpenseInMonth += converted;
    if (FIXED_COST_L2.has(row.category_l2)) {
      fixedCostInMonth += converted;
    }
  }

  return {
    month,
    crypto_exposure: Number(cryptoExposure.toFixed(4)),
    crypto_positive_asset_value: Number(cryptoPositiveAssetValue.toFixed(4)),
    total_positive_asset_value: Number(positiveAssetValue.toFixed(4)),
    crypto_over_abs_net_worth: rawCryptoOverNetWorth,
    income_volatility: Number(incomeVolatility.toFixed(4)),
    fixed_cost_ratio:
      totalExpenseInMonth > 0
        ? Number((fixedCostInMonth / totalExpenseInMonth).toFixed(4))
        : 0
  };
}

function buildMonthlyReviewPayload(db, userId, month, baseCurrency = "USD") {
  const rows = db
    .prepare(
      `
        SELECT id, tx_date, type, amount_original, currency_original, category_l1, category_l2, note
        FROM transactions
        WHERE user_id = ? AND substr(tx_date, 1, 7) = ?
      `
    )
    .all(userId, month);

  const byL1 = new Map();
  const byL2 = new Map();
  const expenseList = [];
  let expenseTotal = 0;
  let transferTotal = 0;
  for (const row of rows) {
    const converted = convertCurrency(
      Number(row.amount_original || 0),
      normalizeCurrency(row.currency_original || baseCurrency),
      baseCurrency
    );
    if (row.type === "expense") {
      expenseTotal += converted;
      byL1.set(row.category_l1, (byL1.get(row.category_l1) || 0) + converted);
      const key = `${row.category_l1}|||${row.category_l2}`;
      byL2.set(key, (byL2.get(key) || 0) + converted);
      expenseList.push({
        id: row.id,
        tx_date: row.tx_date,
        amount_base: converted,
        category_l1: row.category_l1,
        category_l2: row.category_l2,
        note: row.note
      });
    } else if (row.type === "transfer") {
      transferTotal += converted;
    }
  }

  const expenseByL1 = [...byL1.entries()]
    .map(([category_l1, total]) => ({ category_l1, total }))
    .sort((a, b) => b.total - a.total);
  const expenseByL2 = [...byL2.entries()]
    .map(([key, total]) => {
      const [category_l1, category_l2] = key.split("|||");
      return { category_l1, category_l2, total };
    })
    .sort((a, b) => b.total - a.total);
  const topExpenses = expenseList.sort((a, b) => b.amount_base - a.amount_base).slice(0, 5);

  const summary = buildMonthlySummary(expenseByL1, expenseTotal, transferTotal);

  return {
    month,
    base_currency: baseCurrency,
    expense_total: expenseTotal,
    transfer_total: transferTotal,
    expense_structure_l1: expenseByL1,
    expense_structure_l2: expenseByL2,
    top_expenses: topExpenses,
    summary
  };
}

function buildMonthlySummary(expenseByL1, expenseTotal, transferTotal) {
  if (expenseTotal <= 0) {
    return "No expense booked this month. Transfers are tracked separately from real spending.";
  }
  const top = expenseByL1[0];
  const ratio = top ? ((top.total / expenseTotal) * 100).toFixed(1) : "0.0";
  return `Top expense category is ${top ? top.category_l1 : "N/A"} (${ratio}% of total expense). Transfer volume (${transferTotal.toFixed(
    2
  )}) is separated from real expense (${expenseTotal.toFixed(2)}).`;
}

function enrichBudgetRow(row) {
  const total = Number(row.total_amount);
  const spent = Number(row.spent_amount);
  return {
    month: row.month,
    category_l1: row.category_l1,
    total_amount: total,
    spent_amount: spent,
    remaining_amount: total - spent,
    progress: total === 0 ? 0 : spent / total,
    overspend: spent > total
  };
}

function getTransactionWithTags(db, userId, txId) {
  const row = db
    .prepare(
      `
        SELECT t.*, GROUP_CONCAT(tg.name, '|') AS tag_names
        FROM transactions t
        LEFT JOIN transaction_tags tt ON tt.transaction_id = t.id
        LEFT JOIN tags tg ON tg.id = tt.tag_id
        WHERE t.user_id = ? AND t.id = ?
        GROUP BY t.id
      `
    )
    .get(userId, txId);
  return {
    ...row,
    amount_base: Number(row.amount_base),
    tags: row.tag_names ? row.tag_names.split("|") : []
  };
}

function normalizeDate(value) {
  if (!value) return null;
  const str = String(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
  return str;
}

function normalizeSupportedCurrency(currency, fieldName = "currency") {
  const normalized = normalizeCurrency(currency || "USD");
  if (SUPPORTED_CURRENCIES.includes(normalized)) {
    return normalized;
  }
  throw new Error(`${fieldName} must be one of: ${SUPPORTED_CURRENCIES.join(", ")}.`);
}

function convertCurrency(amount, fromCurrency, toCurrency) {
  const from = normalizeCurrency(fromCurrency || "USD");
  const to = normalizeCurrency(toCurrency || "USD");
  if (!Number.isFinite(Number(amount))) return 0;
  const numeric = Number(amount);
  if (from === to) return numeric;
  return Number((numeric * fallbackFxRate(from, to)).toFixed(8));
}

function rebuildUserBalances(db, userId) {
  const accounts = db
    .prepare("SELECT id, currency, opening_balance, balance FROM accounts WHERE user_id = ? ORDER BY id")
    .all(userId);
  const accountMap = new Map();
  for (const account of accounts) {
    accountMap.set(account.id, {
      id: account.id,
      currency: normalizeCurrency(account.currency),
      opening_balance: Number(account.opening_balance || 0),
      recalculated: Number(account.opening_balance || 0),
      previous_balance: Number(account.balance || 0)
    });
  }

  const txRows = db
    .prepare(
      `
        SELECT
          id, type, amount_original, currency_original, account_from_id, account_to_id
        FROM transactions
        WHERE user_id = ?
        ORDER BY id
      `
    )
    .all(userId);

  for (const tx of txRows) {
    const amountOriginal = Number(tx.amount_original || 0);
    const sourceCurrency = normalizeCurrency(tx.currency_original || "USD");

    if (tx.type === "expense" && tx.account_from_id && accountMap.has(tx.account_from_id)) {
      const account = accountMap.get(tx.account_from_id);
      account.recalculated -= convertCurrency(amountOriginal, sourceCurrency, account.currency);
    } else if (tx.type === "income" && tx.account_to_id && accountMap.has(tx.account_to_id)) {
      const account = accountMap.get(tx.account_to_id);
      account.recalculated += convertCurrency(amountOriginal, sourceCurrency, account.currency);
    } else if (tx.type === "transfer") {
      if (tx.account_from_id && accountMap.has(tx.account_from_id)) {
        const source = accountMap.get(tx.account_from_id);
        source.recalculated -= convertCurrency(amountOriginal, sourceCurrency, source.currency);
      }
      if (tx.account_to_id && accountMap.has(tx.account_to_id)) {
        const target = accountMap.get(tx.account_to_id);
        target.recalculated += convertCurrency(amountOriginal, sourceCurrency, target.currency);
      }
    }
  }

  const save = db.transaction(() => {
    const update = db.prepare("UPDATE accounts SET balance = ? WHERE id = ? AND user_id = ?");
    for (const account of accountMap.values()) {
      update.run(Number(account.recalculated.toFixed(8)), account.id, userId);
    }
  });
  save();

  return {
    ok: true,
    accounts: [...accountMap.values()].map((row) => ({
      id: row.id,
      currency: row.currency,
      previous_balance: row.previous_balance,
      recalculated_balance: Number(row.recalculated.toFixed(8))
    }))
  };
}

module.exports = {
  createApp,
  buildMonthlySummary,
  buildMonthlyReviewPayload
};
