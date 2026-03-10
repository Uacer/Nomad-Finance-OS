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
const { fetchFxRate, normalizeCurrency } = require("./fx");
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
      timezone: z.string().min(2).max(100).optional()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const payload = parsed.data;
    const current = getUserSettings(db, req.userId);
    const baseCurrency = payload.base_currency
      ? normalizeCurrency(payload.base_currency)
      : current.base_currency;
    const timezone = payload.timezone || current.timezone;
    db.prepare(
      `
        UPDATE user_settings
        SET base_currency = ?, timezone = ?, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `
    ).run(baseCurrency, timezone, req.userId);
    res.json(getUserSettings(db, req.userId));
  });

  app.get("/api/v1/fx/supported-currencies", (_req, res) => {
    res.json({ currencies: SUPPORTED_CURRENCIES });
  });

  app.get("/api/v1/fx/quote", async (req, res) => {
    const from = normalizeCurrency(req.query.from || "USD");
    const to = normalizeCurrency(req.query.to || "USD");
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
    const result = db
      .prepare(
        `
          INSERT INTO accounts (user_id, name, type, currency, balance)
          VALUES (?, ?, ?, ?, ?)
        `
      )
      .run(
        req.userId,
        payload.name.trim(),
        payload.type,
        normalizeCurrency(payload.currency),
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
    res.status(201).json(getProviderPublicView(db, req.userId, providerId));
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
    const draft = await buildExtractionDraft({
      provider,
      text: "Lunch 12 USD at 7-Eleven",
      categories,
      accounts
    });
    res.json({
      ok: true,
      fallback_used: draft.fallback_used,
      error_message: draft.error_message || ""
    });
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
    const categories = getCategoriesMap(db, req.userId);
    const accounts = getAccounts(db, req.userId);
    const extraction = await buildExtractionDraft({
      provider,
      text: input.text,
      imageBase64: null,
      categories,
      accounts
    });
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
    const provider = resolveProviderForUser(db, req.userId, input.provider_id);
    const categories = getCategoriesMap(db, req.userId);
    const accounts = getAccounts(db, req.userId);
    const text = input.ocr_text || "";
    const extraction = await buildExtractionDraft({
      provider,
      text,
      imageBase64: input.image_base64 || null,
      categories,
      accounts
    });
    const draft = await enrichDraftWithFx(db, req.userId, extraction.draft);
    const record = insertExtraction(db, req.userId, {
      source_type: "image",
      raw_text: text,
      raw_image_base64: input.image_base64 || "",
      draft,
      provider_credential_id: provider ? provider.id : null,
      error_message:
        extraction.error_message || (!text ? "No OCR text provided, manual review needed." : "")
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
    const enriched = await enrichDraftWithFx(db, req.userId, parsed.data);
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
    const month = normalizeMonth(req.query.month);
    const params = [req.userId, month];
    const filters = ["t.user_id = ?", "substr(t.tx_date, 1, 7) = ?"];
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
      amount_base: Number(row.amount_base),
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
    const rows = db
      .prepare(
        `
          SELECT
            b.month,
            b.category_l1,
            b.total_amount,
            COALESCE(SUM(t.amount_base), 0) AS spent_amount
          FROM budgets b
          LEFT JOIN transactions t
            ON t.user_id = b.user_id
           AND t.type = 'expense'
           AND t.category_l1 = b.category_l1
           AND substr(t.tx_date, 1, 7) = b.month
          WHERE b.user_id = ?
            AND b.month = ?
          GROUP BY b.id
          ORDER BY b.category_l1
        `
      )
      .all(req.userId, month)
      .map(enrichBudgetRow);
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
    const rows = db
      .prepare(
        `
          SELECT
            y.year,
            y.category_l1,
            y.total_amount,
            COALESCE(SUM(t.amount_base), 0) AS spent_amount
          FROM yearly_budgets y
          LEFT JOIN transactions t
            ON t.user_id = y.user_id
           AND t.type = 'expense'
           AND t.category_l1 = y.category_l1
           AND substr(t.tx_date, 1, 4) = CAST(y.year AS TEXT)
          WHERE y.user_id = ?
            AND y.year = ?
          GROUP BY y.id
          ORDER BY y.category_l1
        `
      )
      .all(req.userId, year)
      .map((row) => ({
        year: row.year,
        ...enrichBudgetRow(row)
      }));
    res.json(rows);
  });

  app.get("/api/v1/funds", (req, res) => {
    const rows = db
      .prepare(
        `
          SELECT id, name, balance, monthly_allocation, created_at
          FROM funds
          WHERE user_id = ?
          ORDER BY name
        `
      )
      .all(req.userId)
      .map((row) => ({
        ...row,
        balance: Number(row.balance),
        monthly_allocation: Number(row.monthly_allocation)
      }));
    res.json(rows);
  });

  app.post("/api/v1/funds", (req, res) => {
    const schema = z.object({
      name: z.string().min(1).max(64),
      balance: z.number().finite().default(0),
      monthly_allocation: z.number().finite().default(0)
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const payload = parsed.data;
    db.prepare(
      `
        INSERT INTO funds (user_id, name, balance, monthly_allocation)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id, name)
        DO UPDATE SET balance = excluded.balance, monthly_allocation = excluded.monthly_allocation
      `
    ).run(req.userId, payload.name.trim(), payload.balance, payload.monthly_allocation);
    logEvent(db, req.userId, "fund_upserted", {
      name: payload.name.trim()
    });
    const row = db
      .prepare("SELECT * FROM funds WHERE user_id = ? AND name = ?")
      .get(req.userId, payload.name.trim());
    res.status(201).json({
      ...row,
      balance: Number(row.balance),
      monthly_allocation: Number(row.monthly_allocation)
    });
  });

  app.post("/api/v1/funds/allocate", (req, res) => {
    const schema = z.object({
      fund_id: z.number().int().positive(),
      month: z.string().min(7).max(7).optional(),
      amount: z.number().positive(),
      note: z.string().max(255).optional()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const payload = parsed.data;
    const fund = db
      .prepare("SELECT * FROM funds WHERE id = ? AND user_id = ?")
      .get(payload.fund_id, req.userId);
    if (!fund) {
      return res.status(404).json({ error: "Fund not found." });
    }
    const tx = db.transaction(() => {
      db.prepare(
        "UPDATE funds SET balance = balance + ? WHERE id = ? AND user_id = ?"
      ).run(payload.amount, payload.fund_id, req.userId);
      db.prepare(
        `
          INSERT INTO fund_ledger (fund_id, user_id, month, amount, direction, note)
          VALUES (?, ?, ?, ?, 'allocate', ?)
        `
      ).run(payload.fund_id, req.userId, payload.month || normalizeMonth(), payload.amount, payload.note || "");
    });
    tx();
    logEvent(db, req.userId, "fund_allocated", {
      fund_id: payload.fund_id,
      month: payload.month || normalizeMonth()
    });
    const updated = db
      .prepare("SELECT * FROM funds WHERE id = ? AND user_id = ?")
      .get(payload.fund_id, req.userId);
    res.status(201).json({
      ...updated,
      balance: Number(updated.balance),
      monthly_allocation: Number(updated.monthly_allocation)
    });
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
    logEvent(db, req.userId, "monthly_review_opened", { month });
    const snapshot = db
      .prepare(
        "SELECT payload_json, summary, created_at FROM monthly_review_snapshots WHERE user_id = ? AND month = ?"
      )
      .get(req.userId, month);
    if (snapshot) {
      const payload = JSON.parse(snapshot.payload_json);
      return res.json({ ...payload, summary: snapshot.summary, source: "snapshot", created_at: snapshot.created_at });
    }
    const payload = buildMonthlyReviewPayload(db, req.userId, month);
    return res.json({ ...payload, source: "live" });
  });

  app.post("/api/v1/reviews/monthly/generate", (req, res) => {
    const schema = z.object({ month: z.string().min(7).max(7).optional() });
    const parsed = schema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const month = normalizeMonth(parsed.data.month);
    const payload = buildMonthlyReviewPayload(db, req.userId, month);
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
      "SELECT user_id, base_currency, timezone, default_ai_provider_id FROM user_settings WHERE user_id = ?"
    )
    .get(userId);
  if (!row) {
    ensureUserAndSeedDefaults(db, userId);
    return getUserSettings(db, userId);
  }
  return {
    user_id: row.user_id,
    base_currency: normalizeCurrency(row.base_currency || "USD"),
    timezone: row.timezone || "UTC",
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
      normalizeCurrency(payload.currency_original),
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
      updateBalance.run(-amountBase, from.id, userId);
    } else if (type === "income") {
      updateBalance.run(amountBase, to.id, userId);
    } else if (type === "transfer") {
      updateBalance.run(-amountBase, from.id, userId);
      updateBalance.run(amountBase, to.id, userId);
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
  const netWorth =
    Number(
      db
        .prepare("SELECT COALESCE(SUM(balance), 0) AS value FROM accounts WHERE user_id = ?")
        .get(userId).value
    ) || 0;
  const liquidCash =
    Number(
      db
        .prepare(
          "SELECT COALESCE(SUM(balance), 0) AS value FROM accounts WHERE user_id = ? AND type != 'restricted_cash'"
        )
        .get(userId).value
    ) || 0;
  const restrictedCashTotal =
    Number(
      db
        .prepare(
          "SELECT COALESCE(SUM(balance), 0) AS value FROM accounts WHERE user_id = ? AND type = 'restricted_cash'"
        )
        .get(userId).value
    ) || 0;
  const monthly = db
    .prepare(
      `
        SELECT
          COALESCE(SUM(CASE WHEN type = 'income' THEN amount_base END), 0) AS monthly_income,
          COALESCE(SUM(CASE WHEN type = 'expense' THEN amount_base END), 0) AS monthly_expense
        FROM transactions
        WHERE user_id = ?
          AND substr(tx_date, 1, 7) = ?
      `
    )
    .get(userId, month);
  const monthlyIncome = Number(monthly.monthly_income) || 0;
  const monthlyExpense = Number(monthly.monthly_expense) || 0;

  const budgetStatus = db
    .prepare(
      `
        SELECT
          b.category_l1,
          b.total_amount,
          COALESCE(SUM(t.amount_base), 0) AS spent_amount
        FROM budgets b
        LEFT JOIN transactions t
          ON t.user_id = b.user_id
         AND t.type = 'expense'
         AND t.category_l1 = b.category_l1
         AND substr(t.tx_date, 1, 7) = b.month
        WHERE b.user_id = ?
          AND b.month = ?
        GROUP BY b.id
        ORDER BY b.category_l1
      `
    )
    .all(userId, month)
    .map((row) => ({
      category_l1: row.category_l1,
      total_amount: Number(row.total_amount),
      spent_amount: Number(row.spent_amount),
      remaining_amount: Number(row.total_amount) - Number(row.spent_amount),
      overspend: Number(row.spent_amount) > Number(row.total_amount)
    }));

  const burnRate = computeBurnRate(db, userId);
  const runway = burnRate > 0 ? Number((liquidCash / burnRate).toFixed(2)) : null;

  return {
    month,
    base_currency: baseCurrency,
    net_worth: netWorth,
    liquid_cash: liquidCash,
    restricted_cash_total: restrictedCashTotal,
    monthly_income: monthlyIncome,
    monthly_expense: monthlyExpense,
    net_cash_flow: monthlyIncome - monthlyExpense,
    burn_rate: Number(burnRate.toFixed(2)),
    runway_months: runway,
    budget_status: budgetStatus
  };
}

function computeBurnRate(db, userId) {
  const rows = db
    .prepare(
      `
        SELECT
          substr(tx_date, 1, 7) AS month,
          COALESCE(SUM(CASE WHEN type = 'income' THEN amount_base END), 0) AS income,
          COALESCE(SUM(CASE WHEN type = 'expense' THEN amount_base END), 0) AS expense
        FROM transactions
        WHERE user_id = ?
        GROUP BY substr(tx_date, 1, 7)
        ORDER BY month DESC
        LIMIT 3
      `
    )
    .all(userId);
  if (!rows.length) return 0;
  const burns = rows.map((row) => Math.max(0, Number(row.expense) - Number(row.income)));
  return burns.reduce((sum, value) => sum + value, 0) / burns.length;
}

function buildRiskPayload(db, userId, month) {
  const netWorth =
    Number(
      db
        .prepare("SELECT COALESCE(SUM(balance), 0) AS value FROM accounts WHERE user_id = ?")
        .get(userId).value
    ) || 0;
  const cryptoValue =
    Number(
      db
        .prepare(
          "SELECT COALESCE(SUM(balance), 0) AS value FROM accounts WHERE user_id = ? AND type IN ('crypto_wallet', 'exchange')"
        )
        .get(userId).value
    ) || 0;

  const incomeRows = db
    .prepare(
      `
        SELECT substr(tx_date, 1, 7) AS month, COALESCE(SUM(amount_base), 0) AS income
        FROM transactions
        WHERE user_id = ? AND type = 'income'
        GROUP BY substr(tx_date, 1, 7)
        ORDER BY month DESC
        LIMIT 6
      `
    )
    .all(userId)
    .map((row) => Number(row.income));
  const avgIncome =
    incomeRows.length > 0
      ? incomeRows.reduce((sum, value) => sum + value, 0) / incomeRows.length
      : 0;
  const variance =
    incomeRows.length > 0
      ? incomeRows.reduce((sum, value) => sum + (value - avgIncome) ** 2, 0) / incomeRows.length
      : 0;
  const incomeVolatility = avgIncome > 0 ? Math.sqrt(variance) / avgIncome : 0;

  const fixedCostInMonth =
    Number(
      db
        .prepare(
          `
            SELECT COALESCE(SUM(amount_base), 0) AS value
            FROM transactions
            WHERE user_id = ?
              AND type = 'expense'
              AND substr(tx_date, 1, 7) = ?
              AND category_l2 IN (${[...FIXED_COST_L2].map(() => "?").join(", ")})
          `
        )
        .get(userId, month, ...FIXED_COST_L2).value
    ) || 0;

  const totalExpenseInMonth =
    Number(
      db
        .prepare(
          `
            SELECT COALESCE(SUM(amount_base), 0) AS value
            FROM transactions
            WHERE user_id = ? AND type = 'expense' AND substr(tx_date, 1, 7) = ?
          `
        )
        .get(userId, month).value
    ) || 0;

  return {
    month,
    crypto_exposure: netWorth > 0 ? Number((cryptoValue / netWorth).toFixed(4)) : 0,
    income_volatility: Number(incomeVolatility.toFixed(4)),
    fixed_cost_ratio:
      totalExpenseInMonth > 0
        ? Number((fixedCostInMonth / totalExpenseInMonth).toFixed(4))
        : 0
  };
}

function buildMonthlyReviewPayload(db, userId, month) {
  const expenseByL1 = db
    .prepare(
      `
        SELECT category_l1, COALESCE(SUM(amount_base), 0) AS total
        FROM transactions
        WHERE user_id = ? AND type = 'expense' AND substr(tx_date, 1, 7) = ?
        GROUP BY category_l1
        ORDER BY total DESC
      `
    )
    .all(userId, month)
    .map((row) => ({ category_l1: row.category_l1, total: Number(row.total) }));
  const expenseByL2 = db
    .prepare(
      `
        SELECT category_l1, category_l2, COALESCE(SUM(amount_base), 0) AS total
        FROM transactions
        WHERE user_id = ? AND type = 'expense' AND substr(tx_date, 1, 7) = ?
        GROUP BY category_l1, category_l2
        ORDER BY total DESC
      `
    )
    .all(userId, month)
    .map((row) => ({
      category_l1: row.category_l1,
      category_l2: row.category_l2,
      total: Number(row.total)
    }));
  const topExpenses = db
    .prepare(
      `
        SELECT id, tx_date, amount_base, category_l1, category_l2, note
        FROM transactions
        WHERE user_id = ? AND type = 'expense' AND substr(tx_date, 1, 7) = ?
        ORDER BY amount_base DESC, id DESC
        LIMIT 5
      `
    )
    .all(userId, month)
    .map((row) => ({ ...row, amount_base: Number(row.amount_base) }));
  const totals = db
    .prepare(
      `
        SELECT
          COALESCE(SUM(CASE WHEN type = 'expense' THEN amount_base END), 0) AS expense_total,
          COALESCE(SUM(CASE WHEN type = 'transfer' THEN amount_base END), 0) AS transfer_total
        FROM transactions
        WHERE user_id = ? AND substr(tx_date, 1, 7) = ?
      `
    )
    .get(userId, month);

  const expenseTotal = Number(totals.expense_total) || 0;
  const transferTotal = Number(totals.transfer_total) || 0;
  const summary = buildMonthlySummary(expenseByL1, expenseTotal, transferTotal);

  return {
    month,
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

module.exports = {
  createApp,
  buildMonthlySummary,
  buildMonthlyReviewPayload
};
