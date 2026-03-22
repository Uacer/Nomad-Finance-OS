const path = require("node:path");
const { createHash, randomBytes, randomInt, randomUUID } = require("node:crypto");
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
const {
  ensureUserAndSeedDefaults,
  findOrCreateUserByEmail,
  getUserById,
  normalizeMonth
} = require("./db");
const { fetchFxRate, normalizeCurrency, peekRecentRate } = require("./fx");

const FX_RATE_CACHE_TTL_MS = Math.max(
  60 * 60 * 1000,
  Number.parseInt(String(process.env.FX_RATE_CACHE_TTL_MS || `${24 * 60 * 60 * 1000}`), 10) ||
    24 * 60 * 60 * 1000
);
const FX_RATE_CACHE = new Map();
const FX_CONVERT_MAX_AGE_MS = Math.max(
  60 * 60 * 1000,
  Number.parseInt(String(process.env.FX_CONVERT_MAX_AGE_MS || `${36 * 60 * 60 * 1000}`), 10) ||
    36 * 60 * 60 * 1000
);
const AUTH_CODE_TTL_MINUTES = Math.max(
  3,
  Number.parseInt(
    String(process.env.AUTH_CODE_TTL_MINUTES || process.env.MAGIC_LINK_TTL_MINUTES || "10"),
    10
  ) || 10
);
const AUTH_SESSION_TTL_DAYS = Math.max(
  1,
  Number.parseInt(String(process.env.AUTH_SESSION_TTL_DAYS || "7"), 10) || 7
);
const AUTH_CODE_REQUEST_RATE_LIMIT_WINDOW_MS = Math.max(
  10_000,
  Number.parseInt(
    String(
      process.env.AUTH_CODE_REQUEST_RATE_LIMIT_WINDOW_MS ||
        process.env.MAGIC_LINK_RATE_LIMIT_WINDOW_MS ||
        "60000"
    ),
    10
  ) || 60_000
);
const AUTH_CODE_REQUEST_RATE_LIMIT_MAX = Math.max(
  1,
  Number.parseInt(
    String(process.env.AUTH_CODE_REQUEST_RATE_LIMIT_MAX || process.env.MAGIC_LINK_RATE_LIMIT_MAX || "5"),
    10
  ) || 5
);
const AUTH_CODE_VERIFY_RATE_LIMIT_WINDOW_MS = Math.max(
  10_000,
  Number.parseInt(String(process.env.AUTH_CODE_VERIFY_RATE_LIMIT_WINDOW_MS || "60000"), 10) || 60_000
);
const AUTH_CODE_VERIFY_RATE_LIMIT_MAX = Math.max(
  1,
  Number.parseInt(String(process.env.AUTH_CODE_VERIFY_RATE_LIMIT_MAX || "10"), 10) || 10
);
const AUTH_CODE_LENGTH = 6;
const SESSION_COOKIE_NAME = "nfos_session";
const AUTH_CODE_REQUEST_RATE_LIMIT = new Map();
const AUTH_CODE_VERIFY_RATE_LIMIT = new Map();
const DEFAULT_AGENT_SCOPES = [
  "transactions:write",
  "transactions:read",
  "accounts:read",
  "categories:read"
];
const ALLOWED_AGENT_SCOPES = new Set([
  "transactions:write",
  "transactions:read",
  "accounts:read",
  "accounts:write",
  "categories:read",
  "categories:write",
  "settings:read",
  "settings:write",
  "budgets:read",
  "budgets:write",
  "dashboard:read",
  "metrics:read",
  "reviews:read",
  "reviews:write",
  "analytics:read",
  "export:read",
  "tags:read",
  "admin:rebuild-balances"
]);
const CRYPTO_ACCOUNT_TYPES = new Set(["crypto_wallet", "exchange"]);
const UNASSIGNED_ACCOUNT_NAME_ZH = "未分配账户";
const UNASSIGNED_ACCOUNT_NAME_EN = "Unassigned Account";

function createApp(db) {
  const app = express();
  const authAllowDevBypass = parseEnvBoolean(process.env.AUTH_ALLOW_DEV_BYPASS, false);
  const insertAuthEmailCodeStmt = db.prepare(
    `
      INSERT INTO auth_email_codes (
        user_id, email_normalized, code_hash, expires_at, requested_ip, user_agent
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `
  );
  app.use(express.json({ limit: "8mb" }));
  app.use(express.static(path.join(__dirname, "public")));
  app.use((req, res, next) => {
    const startedAt = Date.now();
    const requestId = `r_${randomUUID().slice(0, 12)}`;
    req.requestId = requestId;
    res.setHeader("x-request-id", requestId);

    const originalJson = res.json.bind(res);
    res.locals.errorSummary = "";
    res.json = (payload) => {
      if (payload && typeof payload === "object" && "error" in payload) {
        res.locals.errorSummary = summarizeErrorForLog(payload.error);
      }
      return originalJson(payload);
    };

    res.on("finish", () => {
      if (!(req.path.startsWith("/api/") || req.path === "/health")) {
        return;
      }
      const userId = Number.isInteger(req.userId) ? req.userId : parseUserIdForLog(req.header("x-user-id"));
      const line = {
        request_id: requestId,
        method: req.method,
        path: req.originalUrl || req.path,
        status: res.statusCode,
        duration_ms: Date.now() - startedAt,
        user_id: userId,
        auth_method: req.authMethod || "none",
        token_id: Number.isInteger(req.tokenId) ? req.tokenId : null
      };
      console.log(JSON.stringify({ event: "http_request", ...line }));
      if (res.statusCode >= 400 && res.locals.errorSummary) {
        console.error(
          JSON.stringify({
            event: "http_error",
            ...line,
            error: res.locals.errorSummary
          })
        );
      }
    });
    next();
  });

  app.use((req, res, next) => {
    const isApi = req.path.startsWith("/api/v1/");
    const isVerifyPath = req.path === "/auth/magic-link/verify";
    if (!isApi && !isVerifyPath) return next();

    const bearerToken = extractBearerToken(req);
    if (bearerToken) {
      const token = resolveApiToken(db, bearerToken);
      if (token) {
        req.userId = token.user_id;
        req.userEmail = "";
        req.isAuthenticated = true;
        req.authMethod = "api_token";
        req.tokenId = token.id;
        req.authScopes = token.scopes;
        ensureUserAndSeedDefaults(db, token.user_id);
      }
    }

    if (!req.userId) {
      const sessionToken = getCookie(req, SESSION_COOKIE_NAME);
      if (sessionToken) {
        const session = resolveSession(db, sessionToken);
        if (session) {
          req.userId = session.user_id;
          req.userEmail = session.email || "";
          req.isAuthenticated = true;
          req.authMethod = "session";
          ensureUserAndSeedDefaults(db, session.user_id);
        }
      }
    }

    if (!req.userId && authAllowDevBypass) {
      const rawUserId = String(req.header("x-user-id") || "").trim();
      if (rawUserId) {
        const userId = Number.parseInt(rawUserId, 10);
        if (!Number.isInteger(userId) || userId <= 0) {
          return res.status(400).json({ error: "Invalid x-user-id header." });
        }
        req.userId = userId;
        req.userEmail = "";
        req.isAuthenticated = true;
        req.isDevBypass = true;
        req.authMethod = "dev_bypass";
        ensureUserAndSeedDefaults(db, userId);
      }
    }

    if (!isApi) return next();

    if (
      req.path === "/api/v1/auth/code/request" ||
      req.path === "/api/v1/auth/code/verify" ||
      req.path === "/api/v1/auth/magic-link/request" ||
      req.path === "/api/v1/auth/session" ||
      req.path === "/api/v1/auth/logout"
    ) {
      return next();
    }
    if (!req.userId) {
      return res.status(401).json({ error: "Authentication required." });
    }
    if (req.authMethod === "api_token") {
      const requiredScope = resolveRequiredScope(req);
      if (requiredScope && !hasScope(req.authScopes, requiredScope)) {
        return res.status(403).json({ error: `Insufficient scope. Required: ${requiredScope}.` });
      }
    }
    return next();
  });

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  const requestAuthCode = async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const schema = z.object({ email: z.string().trim().toLowerCase().email().max(320) });
    const parsed = schema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const email = normalizeEmail(parsed.data.email);
    const ip = extractClientIp(req);
    const userAgent = String(req.header("user-agent") || "").slice(0, 250);
    if (
      !consumeRateLimit(
        AUTH_CODE_REQUEST_RATE_LIMIT,
        `email:${email}`,
        AUTH_CODE_REQUEST_RATE_LIMIT_WINDOW_MS,
        AUTH_CODE_REQUEST_RATE_LIMIT_MAX
      ) ||
      !consumeRateLimit(
        AUTH_CODE_REQUEST_RATE_LIMIT,
        `ip:${ip}`,
        AUTH_CODE_REQUEST_RATE_LIMIT_WINDOW_MS,
        AUTH_CODE_REQUEST_RATE_LIMIT_MAX
      )
    ) {
      return res.status(429).json({ error: "Too many verification code requests. Please try again later." });
    }

    const user = findOrCreateUserByEmail(db, email);
    ensureUserAndSeedDefaults(db, user.id);
    revokePendingAuthEmailCodes(db, user.id);
    const code = randomAuthCode();
    const codeHash = hashAuthCode(email, code);
    const expiresAt = new Date(Date.now() + AUTH_CODE_TTL_MINUTES * 60 * 1000).toISOString();
    insertAuthEmailCodeStmt.run(user.id, email, codeHash, expiresAt, ip, userAgent);
    try {
      await sendAuthCodeEmail(email, code);
    } catch (error) {
      return res.status(502).json({ error: String(error?.message || "Email delivery failed.") });
    }
    return res.json({
      ok: true,
      message: "If this email is valid, a verification code has been sent."
    });
  };
  app.post("/api/v1/auth/code/request", requestAuthCode);
  app.post("/api/v1/auth/magic-link/request", requestAuthCode);

  app.post("/api/v1/auth/code/verify", (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const schema = z.object({
      email: z.string().trim().toLowerCase().email().max(320),
      code: z.string().trim().regex(/^\d{6}$/)
    });
    const parsed = schema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const email = normalizeEmail(parsed.data.email);
    const code = String(parsed.data.code || "").trim();
    const ip = extractClientIp(req);
    if (
      !consumeRateLimit(
        AUTH_CODE_VERIFY_RATE_LIMIT,
        `email:${email}`,
        AUTH_CODE_VERIFY_RATE_LIMIT_WINDOW_MS,
        AUTH_CODE_VERIFY_RATE_LIMIT_MAX
      ) ||
      !consumeRateLimit(
        AUTH_CODE_VERIFY_RATE_LIMIT,
        `ip:${ip}`,
        AUTH_CODE_VERIFY_RATE_LIMIT_WINDOW_MS,
        AUTH_CODE_VERIFY_RATE_LIMIT_MAX
      )
    ) {
      return res.status(429).json({ error: "Too many verification attempts. Please try again later." });
    }

    const authCode = consumeAuthEmailCode(db, email, code);
    if (!authCode) {
      return res.status(400).json({ error: "Verification code is invalid or expired." });
    }
    ensureUserAndSeedDefaults(db, authCode.user_id);
    issueSessionCookie(db, req, res, authCode.user_id);
    return res.json({ ok: true });
  });

  app.get("/auth/magic-link/verify", (req, res) => {
    const token = String(req.query.token || "").trim();
    if (!token) {
      return res.status(400).send(renderAuthResultHtml(false, "Missing token."));
    }
    const magic = consumeMagicLink(db, token);
    if (!magic) {
      return res.status(400).send(renderAuthResultHtml(false, "Magic link is invalid or expired."));
    }
    ensureUserAndSeedDefaults(db, magic.user_id);
    issueSessionCookie(db, req, res, magic.user_id);
    return res.redirect(302, resolveAppBaseUrl(req));
  });

  app.get("/api/v1/auth/session", (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    if (!req.userId) {
      return res.json({
        authenticated: false,
        allow_dev_bypass: authAllowDevBypass
      });
    }
    const user = getUserById(db, req.userId);
    return res.json({
      authenticated: true,
      allow_dev_bypass: authAllowDevBypass,
      dev_bypass: Boolean(req.isDevBypass),
      user: {
        id: req.userId,
        email: user?.email || req.userEmail || ""
      }
    });
  });

  app.post("/api/v1/auth/logout", (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const sessionToken = getCookie(req, SESSION_COOKIE_NAME);
    if (sessionToken) {
      const sessionHash = hashToken(sessionToken);
      db.prepare(
        `
          UPDATE auth_sessions
          SET revoked = 1, last_seen_at = CURRENT_TIMESTAMP
          WHERE session_hash = ?
        `
      ).run(sessionHash);
    }
    res.setHeader(
      "Set-Cookie",
      serializeCookie(SESSION_COOKIE_NAME, "", {
        maxAgeSec: 0,
        httpOnly: true,
        sameSite: "Lax",
        secure: isSecureCookieRequest(req),
        path: "/"
      })
    );
    res.json({ ok: true });
  });

  app.post("/api/v1/auth/agent-tokens", requireSessionAuth, (req, res) => {
    const schema = z.object({
      name: z.string().trim().min(1).max(80),
      scopes: z.array(z.string().trim().min(1).max(80)).max(30).optional()
    });
    const parsed = schema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const scopes = normalizeAgentScopes(parsed.data.scopes);
    if (!scopes.length) {
      return res.status(400).json({ error: "At least one valid scope is required." });
    }
    const token = createAgentTokenString();
    const tokenHash = hashToken(token);
    const tokenPrefix = token.slice(0, 14);
    const result = db
      .prepare(
        `
          INSERT INTO auth_api_tokens (
            user_id, name, token_prefix, token_hash, scopes_json, revoked, last_used_at, revoked_at
          ) VALUES (?, ?, ?, ?, ?, 0, NULL, NULL)
        `
      )
      .run(req.userId, parsed.data.name.trim(), tokenPrefix, tokenHash, JSON.stringify(scopes));
    const tokenId = Number(result.lastInsertRowid);
    logEvent(db, req.userId, "agent_token_created", {
      token_id: tokenId,
      scopes
    });
    return res.status(201).json({
      id: tokenId,
      name: parsed.data.name.trim(),
      token_prefix: tokenPrefix,
      scopes,
      token,
      created_at: new Date().toISOString()
    });
  });

  app.get("/api/v1/auth/agent-tokens", requireSessionAuth, (req, res) => {
    const rows = db
      .prepare(
        `
          SELECT id, name, token_prefix, scopes_json, revoked, last_used_at, created_at, revoked_at
          FROM auth_api_tokens
          WHERE user_id = ?
          ORDER BY id DESC
        `
      )
      .all(req.userId)
      .map((row) => {
        const scopes = parseScopesJson(row.scopes_json);
        const prefix = String(row.token_prefix || "");
        const masked = prefix ? `${prefix}...` : "";
        return {
          id: row.id,
          name: row.name,
          token_prefix: prefix,
          token_masked: masked,
          scopes,
          revoked: Boolean(row.revoked),
          last_used_at: row.last_used_at || null,
          created_at: row.created_at,
          revoked_at: row.revoked_at || null
        };
      });
    return res.json(rows);
  });

  app.delete("/api/v1/auth/agent-tokens/:id", requireSessionAuth, (req, res) => {
    const tokenId = Number.parseInt(String(req.params.id), 10);
    if (!Number.isInteger(tokenId) || tokenId <= 0) {
      return res.status(400).json({ error: "Invalid token id." });
    }
    const token = db
      .prepare("SELECT id, revoked FROM auth_api_tokens WHERE id = ? AND user_id = ?")
      .get(tokenId, req.userId);
    if (!token) {
      return res.status(404).json({ error: "Agent token not found." });
    }
    if (!Number(token.revoked || 0)) {
      db.prepare(
        `
          UPDATE auth_api_tokens
          SET revoked = 1, revoked_at = CURRENT_TIMESTAMP
          WHERE id = ? AND user_id = ?
        `
      ).run(tokenId, req.userId);
      logEvent(db, req.userId, "agent_token_revoked", { token_id: tokenId });
    }
    return res.json({ ok: true, id: tokenId, revoked: true });
  });

  app.get("/api/v1/settings", (req, res) => {
    res.json(getUserSettings(db, req.userId));
  });

  app.put("/api/v1/settings", async (req, res) => {
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
    if (baseCurrency !== current.base_currency) {
      try {
        await revalueTransactionsToBaseCurrency(db, req.userId, baseCurrency);
      } catch (error) {
        return res.status(resolveFxErrorStatus(error)).json({ error: formatFxError(error) });
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
    let fx;
    try {
      fx = await fetchFxRate(from, to);
    } catch (error) {
      return res.status(resolveFxErrorStatus(error)).json({ error: formatFxError(error) });
    }
    res.json({
      from,
      to,
      rate: fx.rate,
      source: fx.source,
      timestamp: new Date().toISOString(),
      as_of: fx.as_of || null,
      age_ms: Number.isFinite(Number(fx.age_ms)) ? Number(fx.age_ms) : null,
      is_stale: Boolean(fx.is_stale)
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

  app.put("/api/v1/categories/l1/rename", (req, res) => {
    const schema = z.object({
      old_name: z.string().min(1).max(64),
      new_name: z.string().min(1).max(64)
    });
    const parsed = schema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const oldName = parsed.data.old_name.trim();
    const newName = parsed.data.new_name.trim();
    if (!oldName || !newName) {
      return res.status(400).json({ error: "old_name and new_name are required." });
    }
    if (oldName === newName) {
      return res.json({ ok: true, old_name: oldName, new_name: newName });
    }
    const renameTx = db.transaction(() => {
      const current = db
        .prepare("SELECT id FROM expense_category_l1 WHERE user_id = ? AND name = ?")
        .get(req.userId, oldName);
      if (!current) {
        const error = new Error("Category L1 not found.");
        error.code = "CATEGORY_L1_NOT_FOUND";
        throw error;
      }
      const conflict = db
        .prepare("SELECT id FROM expense_category_l1 WHERE user_id = ? AND name = ?")
        .get(req.userId, newName);
      if (conflict && conflict.id !== current.id) {
        const error = new Error("Category L1 name already exists.");
        error.code = "CATEGORY_L1_CONFLICT";
        throw error;
      }

      db.prepare(
        `
          UPDATE expense_category_l1
          SET name = ?
          WHERE user_id = ? AND id = ?
        `
      ).run(newName, req.userId, current.id);
      db.prepare(
        `
          UPDATE transactions
          SET category_l1 = ?
          WHERE user_id = ? AND category_l1 = ?
        `
      ).run(newName, req.userId, oldName);
      db.prepare(
        `
          INSERT INTO budgets (user_id, month, category_l1, total_amount, budget_currency)
          SELECT user_id, month, ?, total_amount, budget_currency
          FROM budgets
          WHERE user_id = ? AND category_l1 = ?
          ON CONFLICT(user_id, month, category_l1)
          DO UPDATE SET total_amount = excluded.total_amount, budget_currency = excluded.budget_currency
        `
      ).run(newName, req.userId, oldName);
      db.prepare(
        `
          DELETE FROM budgets
          WHERE user_id = ? AND category_l1 = ?
        `
      ).run(req.userId, oldName);
      db.prepare(
        `
          INSERT INTO yearly_budgets (user_id, year, category_l1, total_amount, budget_currency)
          SELECT user_id, year, ?, total_amount, budget_currency
          FROM yearly_budgets
          WHERE user_id = ? AND category_l1 = ?
          ON CONFLICT(user_id, year, category_l1)
          DO UPDATE SET total_amount = excluded.total_amount, budget_currency = excluded.budget_currency
        `
      ).run(newName, req.userId, oldName);
      db.prepare(
        `
          DELETE FROM yearly_budgets
          WHERE user_id = ? AND category_l1 = ?
        `
      ).run(req.userId, oldName);
    });

    try {
      renameTx();
    } catch (error) {
      if (error?.code === "CATEGORY_L1_NOT_FOUND") {
        return res.status(404).json({ error: String(error.message || "Category L1 not found.") });
      }
      if (error?.code === "CATEGORY_L1_CONFLICT") {
        return res.status(409).json({ error: String(error.message || "Category L1 name already exists.") });
      }
      return res.status(500).json({ error: "Failed to rename category." });
    }

    res.json({ ok: true, old_name: oldName, new_name: newName });
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

  app.delete("/api/v1/categories/l2", (req, res) => {
    const schema = z.object({
      l1_name: z.string().min(1).max(64),
      name: z.string().min(1).max(64)
    });
    const parsed = schema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const l1Name = parsed.data.l1_name.trim();
    const l2Name = parsed.data.name.trim();
    const l1 = db
      .prepare("SELECT id FROM expense_category_l1 WHERE user_id = ? AND name = ?")
      .get(req.userId, l1Name);
    if (!l1) {
      return res.status(404).json({ error: "Category L1 not found." });
    }
    const result = db
      .prepare(
        `
          UPDATE expense_category_l2
          SET active = 0
          WHERE user_id = ? AND l1_id = ? AND name = ?
        `
      )
      .run(req.userId, l1.id, l2Name);
    if (!Number(result.changes || 0)) {
      return res.status(404).json({ error: "Category L2 not found." });
    }
    res.json({ ok: true, l1_name: l1Name, name: l2Name, active: false });
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

  app.get("/api/v1/accounts/:id/usage", (req, res) => {
    const accountId = Number.parseInt(String(req.params.id), 10);
    if (!Number.isInteger(accountId) || accountId <= 0) {
      return res.status(400).json({ error: "Invalid account id." });
    }
    const account = db
      .prepare("SELECT id FROM accounts WHERE user_id = ? AND id = ?")
      .get(req.userId, accountId);
    if (!account) {
      return res.status(404).json({ error: "Account not found." });
    }
    const linkedTransactions = countLinkedTransactions(db, req.userId, accountId);
    res.json({ account_id: accountId, linked_transactions: linkedTransactions });
  });

  app.patch("/api/v1/accounts/:id", (req, res) => {
    const accountId = Number.parseInt(String(req.params.id), 10);
    if (!Number.isInteger(accountId) || accountId <= 0) {
      return res.status(400).json({ error: "Invalid account id." });
    }
    const schema = z.object({
      balance: z.number().finite(),
      type: z.enum(ACCOUNT_TYPES).optional()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const account = db
      .prepare("SELECT id, currency, type FROM accounts WHERE user_id = ? AND id = ?")
      .get(req.userId, accountId);
    if (!account) {
      return res.status(404).json({ error: "Account not found." });
    }

    const accountCurrency = normalizeCurrency(account.currency || "USD");
    const txDelta = computeAccountTxDelta(db, req.userId, accountId, accountCurrency);
    const nextBalance = Number(parsed.data.balance);
    const nextOpening = Number((nextBalance - txDelta).toFixed(8));
    const nextType = parsed.data.type || account.type;

    db.prepare(
      `
        UPDATE accounts
        SET type = ?, opening_balance = ?, balance = ?
        WHERE user_id = ? AND id = ?
      `
    ).run(nextType, nextOpening, nextBalance, req.userId, accountId);

    const updated = db
      .prepare("SELECT * FROM accounts WHERE user_id = ? AND id = ?")
      .get(req.userId, accountId);
    res.json(updated);
  });

  app.delete("/api/v1/accounts/:id", async (req, res) => {
    const accountId = Number.parseInt(String(req.params.id), 10);
    if (!Number.isInteger(accountId) || accountId <= 0) {
      return res.status(400).json({ error: "Invalid account id." });
    }
    const forceDelete = String(req.query.force || "").toLowerCase() === "true";
    const account = db
      .prepare("SELECT id FROM accounts WHERE user_id = ? AND id = ?")
      .get(req.userId, accountId);
    if (!account) {
      return res.status(404).json({ error: "Account not found." });
    }
    const linkedTransactions = countLinkedTransactions(db, req.userId, accountId);
    if (linkedTransactions > 0 && !forceDelete) {
      return res.status(409).json({
        error: "Account has linked transactions and cannot be deleted.",
        error_code: "ACCOUNT_LINKED_TRANSACTIONS",
        linked_transactions: linkedTransactions
      });
    }

    if (forceDelete) {
      const deleteTransactions = db.prepare(
        `
          DELETE FROM transactions
          WHERE user_id = ? AND (account_from_id = ? OR account_to_id = ?)
        `
      );
      const deleteAccount = db.prepare("DELETE FROM accounts WHERE user_id = ? AND id = ?");
      const runForcedDelete = db.transaction(() => {
        const txResult = deleteTransactions.run(req.userId, accountId, accountId);
        const accountResult = deleteAccount.run(req.userId, accountId);
        if (accountResult.changes === 0) {
          throw new Error("Account not found.");
        }
        return Number(txResult.changes || 0);
      });
      const deletedTransactions = runForcedDelete();
      try {
        await ensureRebuildFxCoverage(db, req.userId);
      } catch (error) {
        return res.status(resolveFxErrorStatus(error)).json({ error: formatFxError(error) });
      }
      rebuildUserBalances(db, req.userId);
      return res.json({ ok: true, forced: true, deleted_transactions: deletedTransactions });
    }

    db.prepare("DELETE FROM accounts WHERE user_id = ? AND id = ?").run(req.userId, accountId);
    res.json({ ok: true, forced: false, deleted_transactions: 0 });
  });

  app.post("/api/v1/admin/rebuild-balances", async (req, res) => {
    try {
      await ensureRebuildFxCoverage(db, req.userId);
    } catch (error) {
      return res.status(resolveFxErrorStatus(error)).json({ error: formatFxError(error) });
    }
    const result = rebuildUserBalances(db, req.userId);
    res.status(201).json(result);
  });

  app.get("/api/v1/crypto/token-prices", (req, res) => {
    const rawSymbols = String(req.query.symbols || "").trim();
    let symbols = [];
    if (rawSymbols) {
      try {
        symbols = [
          ...new Set(
            rawSymbols
              .split(",")
              .map((item) => String(item || "").trim())
              .filter(Boolean)
              .map((item) => normalizeTokenSymbol(item))
          )
        ];
      } catch (error) {
        return res.status(400).json({ error: String(error.message || "Invalid symbols query.") });
      }
    }
    let rows = [];
    if (!symbols.length) {
      rows = db
        .prepare(
          `
            SELECT symbol, price, price_currency, source, as_of, updated_at
            FROM crypto_token_prices
            WHERE user_id = ?
            ORDER BY symbol ASC
          `
        )
        .all(req.userId);
    } else {
      const placeholders = symbols.map(() => "?").join(", ");
      rows = db
        .prepare(
          `
            SELECT symbol, price, price_currency, source, as_of, updated_at
            FROM crypto_token_prices
            WHERE user_id = ? AND symbol IN (${placeholders})
            ORDER BY symbol ASC
          `
        )
        .all(req.userId, ...symbols);
    }
    res.json(rows.map((row) => mapCryptoTokenPriceRow(row)));
  });

  app.post("/api/v1/crypto/token-prices", (req, res) => {
    const schema = z.object({
      symbol: z.string().min(1).max(24),
      price: z.number().positive(),
      price_currency: z.string().min(3).max(8).optional(),
      source: z.string().trim().max(80).optional(),
      as_of: z.string().trim().max(64).optional()
    });
    const parsed = schema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    let symbol;
    let priceCurrency;
    try {
      symbol = normalizeTokenSymbol(parsed.data.symbol);
      priceCurrency = normalizeSupportedCurrency(parsed.data.price_currency || "USD", "price_currency");
    } catch (error) {
      return res.status(400).json({ error: String(error.message || "Invalid crypto token price payload.") });
    }
    const source = String(parsed.data.source || "manual").trim() || "manual";
    const asOf = parsed.data.as_of ? String(parsed.data.as_of).trim() : null;
    db.prepare(
      `
        INSERT INTO crypto_token_prices (
          user_id, symbol, price, price_currency, source, as_of
        )
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, symbol)
        DO UPDATE SET
          price = excluded.price,
          price_currency = excluded.price_currency,
          source = excluded.source,
          as_of = excluded.as_of,
          updated_at = CURRENT_TIMESTAMP
      `
    ).run(req.userId, symbol, Number(parsed.data.price), priceCurrency, source, asOf);
    const row = db
      .prepare(
        `
          SELECT symbol, price, price_currency, source, as_of, updated_at
          FROM crypto_token_prices
          WHERE user_id = ? AND symbol = ?
        `
      )
      .get(req.userId, symbol);
    logEvent(db, req.userId, "crypto_token_price_upserted", {
      symbol,
      price_currency: priceCurrency
    });
    res.status(201).json(mapCryptoTokenPriceRow(row));
  });

  app.get("/api/v1/crypto/accounts/:id/positions", (req, res) => {
    const accountId = Number.parseInt(String(req.params.id), 10);
    if (!Number.isInteger(accountId) || accountId <= 0) {
      return res.status(400).json({ error: "Invalid account id." });
    }
    let account;
    try {
      account = ensureCryptoAccount(db, req.userId, accountId);
    } catch (error) {
      if (error?.code === "ACCOUNT_NOT_FOUND") {
        return res.status(404).json({ error: String(error.message || "Account not found.") });
      }
      return res.status(400).json({ error: String(error.message || "Invalid crypto account.") });
    }
    const rows = db
      .prepare(
        `
          SELECT
            p.account_id,
            p.symbol,
            p.quantity,
            p.updated_at AS position_updated_at,
            pr.price,
            pr.price_currency,
            pr.source AS price_source,
            pr.as_of,
            pr.updated_at AS price_updated_at
          FROM crypto_positions p
          LEFT JOIN crypto_token_prices pr
            ON pr.user_id = p.user_id AND pr.symbol = p.symbol
          WHERE p.user_id = ? AND p.account_id = ?
          ORDER BY p.symbol ASC
        `
      )
      .all(req.userId, accountId);
    res.json({
      account_id: account.id,
      account_name: account.name,
      account_type: account.type,
      account_currency: normalizeCurrency(account.currency || "USD"),
      positions: rows.map((row) => mapCryptoPositionRow(row))
    });
  });

  app.post("/api/v1/crypto/accounts/:id/positions", (req, res) => {
    const accountId = Number.parseInt(String(req.params.id), 10);
    if (!Number.isInteger(accountId) || accountId <= 0) {
      return res.status(400).json({ error: "Invalid account id." });
    }
    const schema = z.object({
      symbol: z.string().min(1).max(24),
      quantity: z.number().finite().min(0)
    });
    const parsed = schema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    let account;
    let symbol;
    try {
      account = ensureCryptoAccount(db, req.userId, accountId);
      symbol = normalizeTokenSymbol(parsed.data.symbol);
    } catch (error) {
      if (error?.code === "ACCOUNT_NOT_FOUND") {
        return res.status(404).json({ error: String(error.message || "Account not found.") });
      }
      return res.status(400).json({ error: String(error.message || "Invalid crypto position payload.") });
    }
    const quantity = Number(parsed.data.quantity);
    if (!Number.isFinite(quantity) || quantity < 0) {
      return res.status(400).json({ error: "quantity must be greater than or equal to 0." });
    }
    if (quantity === 0) {
      db.prepare("DELETE FROM crypto_positions WHERE user_id = ? AND account_id = ? AND symbol = ?").run(
        req.userId,
        accountId,
        symbol
      );
      return res.json({ ok: true, account_id: accountId, symbol, quantity: 0, deleted: true });
    }
    db.prepare(
      `
        INSERT INTO crypto_positions (user_id, account_id, symbol, quantity)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id, account_id, symbol)
        DO UPDATE SET
          quantity = excluded.quantity,
          updated_at = CURRENT_TIMESTAMP
      `
    ).run(req.userId, accountId, symbol, quantity);
    const row = db
      .prepare(
        `
          SELECT
            p.account_id,
            p.symbol,
            p.quantity,
            p.updated_at AS position_updated_at,
            pr.price,
            pr.price_currency,
            pr.source AS price_source,
            pr.as_of,
            pr.updated_at AS price_updated_at
          FROM crypto_positions p
          LEFT JOIN crypto_token_prices pr
            ON pr.user_id = p.user_id AND pr.symbol = p.symbol
          WHERE p.user_id = ? AND p.account_id = ? AND p.symbol = ?
        `
      )
      .get(req.userId, accountId, symbol);
    logEvent(db, req.userId, "crypto_position_upserted", {
      account_id: accountId,
      account_type: account.type,
      symbol
    });
    res.status(201).json({
      account_id: account.id,
      account_name: account.name,
      account_type: account.type,
      account_currency: normalizeCurrency(account.currency || "USD"),
      ...mapCryptoPositionRow(row)
    });
  });

  app.delete("/api/v1/crypto/accounts/:id/positions/:symbol", (req, res) => {
    const accountId = Number.parseInt(String(req.params.id), 10);
    if (!Number.isInteger(accountId) || accountId <= 0) {
      return res.status(400).json({ error: "Invalid account id." });
    }
    let symbol;
    try {
      ensureCryptoAccount(db, req.userId, accountId);
      symbol = normalizeTokenSymbol(req.params.symbol);
    } catch (error) {
      if (error?.code === "ACCOUNT_NOT_FOUND") {
        return res.status(404).json({ error: String(error.message || "Account not found.") });
      }
      return res.status(400).json({ error: String(error.message || "Invalid request.") });
    }
    const result = db
      .prepare("DELETE FROM crypto_positions WHERE user_id = ? AND account_id = ? AND symbol = ?")
      .run(req.userId, accountId, symbol);
    if (!Number(result.changes || 0)) {
      return res.status(404).json({ error: "Position not found." });
    }
    logEvent(db, req.userId, "crypto_position_deleted", {
      account_id: accountId,
      symbol
    });
    res.json({ ok: true, account_id: accountId, symbol });
  });

  app.get("/api/v1/crypto/portfolio", async (req, res) => {
    const baseCurrency = getUserSettings(db, req.userId).base_currency;
    try {
      await ensureCryptoPortfolioFxCoverage(db, req.userId, baseCurrency);
    } catch (error) {
      return res.status(resolveFxErrorStatus(error)).json({ error: formatFxError(error) });
    }
    try {
      res.json(buildCryptoPortfolioPayload(db, req.userId, baseCurrency));
    } catch (error) {
      return res.status(resolveFxErrorStatus(error)).json({ error: formatFxError(error) });
    }
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
    let enriched;
    try {
      enriched = await enrichDraftWithFx(db, req.userId, txInput);
    } catch (error) {
      return res.status(resolveFxErrorStatus(error)).json({ error: formatFxError(error) });
    }
    try {
      await ensurePayloadFxCoverage(db, req.userId, enriched);
      await ensureRebuildFxCoverage(db, req.userId);
    } catch (error) {
      return res.status(resolveFxErrorStatus(error)).json({ error: formatFxError(error) });
    }
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
    if (req.authMethod === "api_token") {
      logEvent(db, req.userId, "agent_token_used", {
        token_id: req.tokenId,
        action: "transactions.create",
        transaction_id: tx.id
      });
    }
    res.status(201).json(tx);
  });

  app.get("/api/v1/transactions", async (req, res) => {
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
    const rawRows = db.prepare(sql).all(...params);
    const rows = rawRows.map((row) => ({
      ...row,
      amount_base_snapshot: Number(row.amount_base || 0),
      amount_base: Number(row.amount_base || 0),
      base_currency: baseCurrency,
      effective_fx_rate: Number(row.fx_rate || 1),
      tags: row.tag_names ? row.tag_names.split("|") : []
    }));
    try {
      res.json(rows);
    } catch (error) {
      return res.status(resolveFxErrorStatus(error)).json({ error: formatFxError(error) });
    }
  });

  app.patch("/api/v1/transactions/:id", async (req, res) => {
    const txId = Number.parseInt(String(req.params.id), 10);
    if (!Number.isInteger(txId) || txId <= 0) {
      return res.status(400).json({ error: "Invalid transaction id." });
    }
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
    const existing = db
      .prepare("SELECT id FROM transactions WHERE user_id = ? AND id = ?")
      .get(req.userId, txId);
    if (!existing) {
      return res.status(404).json({ error: "Transaction not found." });
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
    let enriched;
    try {
      enriched = await enrichDraftWithFx(db, req.userId, txInput);
    } catch (error) {
      return res.status(resolveFxErrorStatus(error)).json({ error: formatFxError(error) });
    }
    try {
      await ensurePayloadFxCoverage(db, req.userId, enriched);
      await ensureRebuildFxCoverage(db, req.userId);
    } catch (error) {
      return res.status(resolveFxErrorStatus(error)).json({ error: formatFxError(error) });
    }
    let tx;
    try {
      tx = updateTransactionRecord(db, req.userId, txId, enriched);
    } catch (error) {
      return res.status(400).json({ error: String(error.message || "Invalid transaction.") });
    }
    logEvent(db, req.userId, "transaction_updated", {
      transaction_id: txId,
      type: tx.type
    });
    res.json(tx);
  });

  app.delete("/api/v1/transactions/:id", async (req, res) => {
    const txId = Number.parseInt(String(req.params.id), 10);
    if (!Number.isInteger(txId) || txId <= 0) {
      return res.status(400).json({ error: "Invalid transaction id." });
    }
    const existing = db
      .prepare("SELECT id, type FROM transactions WHERE user_id = ? AND id = ?")
      .get(req.userId, txId);
    if (!existing) {
      return res.status(404).json({ error: "Transaction not found." });
    }
    try {
      await ensureRebuildFxCoverage(db, req.userId);
    } catch (error) {
      return res.status(resolveFxErrorStatus(error)).json({ error: formatFxError(error) });
    }
    deleteTransactionRecord(db, req.userId, txId);
    logEvent(db, req.userId, "transaction_deleted", {
      transaction_id: txId,
      type: existing.type
    });
    res.json({ ok: true, deleted_transaction_id: txId });
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
    const settings = getUserSettings(db, req.userId);
    if (!isActiveL1(db, req.userId, payload.category_l1)) {
      return res.status(400).json({ error: "Budget category_l1 must be active." });
    }
    db.prepare(
      `
        INSERT INTO budgets (user_id, month, category_l1, total_amount, budget_currency)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(user_id, month, category_l1)
        DO UPDATE SET total_amount = excluded.total_amount, budget_currency = excluded.budget_currency
      `
    ).run(req.userId, payload.month, payload.category_l1, payload.total_amount, settings.base_currency);
    logEvent(db, req.userId, "budget_monthly_upserted", {
      month: payload.month,
      category_l1: payload.category_l1
    });
    res.status(201).json(payload);
  });

  app.get("/api/v1/budgets", async (req, res) => {
    const month = normalizeMonth(req.query.month);
    const baseCurrency = getUserSettings(db, req.userId).base_currency;
    try {
      await ensureBaseFxCoverage(db, req.userId, baseCurrency);
    } catch (error) {
      return res.status(resolveFxErrorStatus(error)).json({ error: formatFxError(error) });
    }
    const expenses = db
      .prepare(
        `
          SELECT category_l1, amount_base
          FROM transactions
          WHERE user_id = ? AND type = 'expense' AND substr(tx_date, 1, 7) = ?
        `
      )
      .all(req.userId, month);
    const spentByCategory = new Map();
    for (const tx of expenses) {
      const spent = Number(tx.amount_base || 0);
      spentByCategory.set(tx.category_l1, (spentByCategory.get(tx.category_l1) || 0) + spent);
    }
    const rows = db
      .prepare(
        `
          SELECT b.month, b.category_l1, b.total_amount, b.budget_currency
          FROM budgets b
          WHERE b.user_id = ? AND b.month = ?
          ORDER BY b.category_l1
        `
      )
      .all(req.userId, month)
      .map((row) => {
        const budgetCurrency = normalizeCurrency(row.budget_currency || baseCurrency);
        const totalInBase = convertCurrency(
          Number(row.total_amount || 0),
          budgetCurrency,
          baseCurrency
        );
        return enrichBudgetRow({
          ...row,
          total_amount: totalInBase,
          budget_currency: budgetCurrency,
          spent_amount: Number(spentByCategory.get(row.category_l1) || 0)
        });
      });
    try {
      res.json(rows);
    } catch (error) {
      return res.status(resolveFxErrorStatus(error)).json({ error: formatFxError(error) });
    }
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
    const settings = getUserSettings(db, req.userId);
    if (!isActiveL1(db, req.userId, payload.category_l1)) {
      return res.status(400).json({ error: "Yearly budget category_l1 must be active." });
    }
    db.prepare(
      `
        INSERT INTO yearly_budgets (user_id, year, category_l1, total_amount, budget_currency)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(user_id, year, category_l1)
        DO UPDATE SET total_amount = excluded.total_amount, budget_currency = excluded.budget_currency
      `
    ).run(req.userId, payload.year, payload.category_l1, payload.total_amount, settings.base_currency);
    logEvent(db, req.userId, "budget_yearly_upserted", {
      year: payload.year,
      category_l1: payload.category_l1
    });
    res.status(201).json(payload);
  });

  app.get("/api/v1/budgets/yearly", async (req, res) => {
    const year =
      Number.parseInt(req.query.year, 10) || Number.parseInt(new Date().toISOString().slice(0, 4), 10);
    const baseCurrency = getUserSettings(db, req.userId).base_currency;
    try {
      await ensureBaseFxCoverage(db, req.userId, baseCurrency);
    } catch (error) {
      return res.status(resolveFxErrorStatus(error)).json({ error: formatFxError(error) });
    }
    const expenses = db
      .prepare(
        `
          SELECT category_l1, amount_base
          FROM transactions
          WHERE user_id = ? AND type = 'expense' AND substr(tx_date, 1, 4) = ?
        `
      )
      .all(req.userId, String(year));
    const spentByCategory = new Map();
    for (const tx of expenses) {
      const spent = Number(tx.amount_base || 0);
      spentByCategory.set(tx.category_l1, (spentByCategory.get(tx.category_l1) || 0) + spent);
    }
    const rows = db
      .prepare(
        `
          SELECT y.year, y.category_l1, y.total_amount, y.budget_currency
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
          total_amount: convertCurrency(
            Number(row.total_amount || 0),
            normalizeCurrency(row.budget_currency || baseCurrency),
            baseCurrency
          ),
          budget_currency: normalizeCurrency(row.budget_currency || baseCurrency),
          spent_amount: Number(spentByCategory.get(row.category_l1) || 0)
        })
      }));
    try {
      res.json(rows);
    } catch (error) {
      return res.status(resolveFxErrorStatus(error)).json({ error: formatFxError(error) });
    }
  });

  app.delete("/api/v1/budgets", (req, res) => {
    const schema = z.object({
      month: z.string().min(7).max(7),
      category_l1: z.string().min(1).max(64)
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const { month, category_l1 } = parsed.data;
    db.prepare("DELETE FROM budgets WHERE user_id = ? AND month = ? AND category_l1 = ?")
      .run(req.userId, month, category_l1);
    logEvent(db, req.userId, "budget_monthly_deleted", { month, category_l1 });
    res.json({ ok: true });
  });

  app.delete("/api/v1/budgets/yearly", (req, res) => {
    const schema = z.object({
      year: z.number().int().min(2000).max(2100),
      category_l1: z.string().min(1).max(64)
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const { year, category_l1 } = parsed.data;
    db.prepare("DELETE FROM yearly_budgets WHERE user_id = ? AND year = ? AND category_l1 = ?")
      .run(req.userId, year, category_l1);
    logEvent(db, req.userId, "budget_yearly_deleted", { year, category_l1 });
    res.json({ ok: true });
  });

  app.get("/api/v1/dashboard", async (req, res) => {
    const month = normalizeMonth(req.query.month);
    const settings = getUserSettings(db, req.userId);
    try {
      await ensureBaseFxCoverage(db, req.userId, settings.base_currency);
    } catch (error) {
      return res.status(resolveFxErrorStatus(error)).json({ error: formatFxError(error) });
    }
    let dashboard;
    try {
      dashboard = buildDashboardPayload(db, req.userId, month, settings.base_currency);
    } catch (error) {
      return res.status(resolveFxErrorStatus(error)).json({ error: formatFxError(error) });
    }
    res.json(dashboard);
  });

  app.get("/api/v1/metrics/runway", async (req, res) => {
    const month = normalizeMonth(req.query.month);
    const baseCurrency = getUserSettings(db, req.userId).base_currency;
    try {
      await ensureBaseFxCoverage(db, req.userId, baseCurrency);
    } catch (error) {
      return res.status(resolveFxErrorStatus(error)).json({ error: formatFxError(error) });
    }
    let dashboard;
    try {
      dashboard = buildDashboardPayload(db, req.userId, month, baseCurrency);
    } catch (error) {
      return res.status(resolveFxErrorStatus(error)).json({ error: formatFxError(error) });
    }
    res.json({
      month,
      liquid_cash: dashboard.liquid_cash,
      burn_rate: dashboard.burn_rate,
      runway_months: dashboard.runway_months
    });
  });

  app.get("/api/v1/metrics/risk", async (req, res) => {
    const month = normalizeMonth(req.query.month);
    const baseCurrency = getUserSettings(db, req.userId).base_currency;
    try {
      await ensureBaseFxCoverage(db, req.userId, baseCurrency);
    } catch (error) {
      return res.status(resolveFxErrorStatus(error)).json({ error: formatFxError(error) });
    }
    try {
      res.json(buildRiskPayload(db, req.userId, month));
    } catch (error) {
      return res.status(resolveFxErrorStatus(error)).json({ error: formatFxError(error) });
    }
  });

  app.get("/api/v1/reviews/monthly", async (req, res) => {
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
    let payload;
    try {
      payload = buildMonthlyReviewPayload(db, req.userId, month, currentBase);
    } catch (error) {
      return res.status(resolveFxErrorStatus(error)).json({ error: formatFxError(error) });
    }
    return res.json({ ...payload, source: "live" });
  });

  app.post("/api/v1/reviews/monthly/generate", async (req, res) => {
    const schema = z.object({ month: z.string().min(7).max(7).optional() });
    const parsed = schema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const month = normalizeMonth(parsed.data.month);
    const baseCurrency = getUserSettings(db, req.userId).base_currency;
    let payload;
    try {
      payload = buildMonthlyReviewPayload(db, req.userId, month, baseCurrency);
    } catch (error) {
      return res.status(resolveFxErrorStatus(error)).json({ error: formatFxError(error) });
    }
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
    const status = resolveFxErrorStatus(error);
    if (status !== 500) {
      return res.status(status).json({ error: formatFxError(error) });
    }
    res.status(500).json({ error: "Internal server error." });
  });

  return app;
}

function getUserSettings(db, userId) {
  const row = db
    .prepare(
      "SELECT user_id, base_currency, timezone, ui_language FROM user_settings WHERE user_id = ?"
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
    ui_language: row.ui_language === "zh" ? "zh" : "en"
  };
}

function getAccounts(db, userId) {
  return db
    .prepare("SELECT * FROM accounts WHERE user_id = ? ORDER BY id")
    .all(userId);
}

function getOrCreateUnassignedAccount(db, userId) {
  const settings = getUserSettings(db, userId);
  const preferredName = settings.ui_language === "zh" ? UNASSIGNED_ACCOUNT_NAME_ZH : UNASSIGNED_ACCOUNT_NAME_EN;
  const fallbackName = preferredName === UNASSIGNED_ACCOUNT_NAME_ZH ? UNASSIGNED_ACCOUNT_NAME_EN : UNASSIGNED_ACCOUNT_NAME_ZH;
  const existing = db
    .prepare(
      `
        SELECT *
        FROM accounts
        WHERE user_id = ? AND name IN (?, ?)
        ORDER BY CASE name WHEN ? THEN 0 WHEN ? THEN 1 ELSE 2 END, id ASC
        LIMIT 1
      `
    )
    .get(userId, preferredName, fallbackName, preferredName, fallbackName);
  if (existing) return existing;
  const accountCurrency = normalizeSupportedCurrency(settings.base_currency || "USD", "currency");
  const result = db
    .prepare(
      `
        INSERT INTO accounts (user_id, name, type, currency, opening_balance, balance)
        VALUES (?, ?, 'cash', ?, 0, 0)
      `
    )
    .run(userId, preferredName, accountCurrency);
  return db
    .prepare("SELECT * FROM accounts WHERE user_id = ? AND id = ?")
    .get(userId, Number(result.lastInsertRowid));
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

function normalizeTokenSymbol(value, fieldName = "symbol") {
  const symbol = String(value || "").trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9._-]{1,19}$/.test(symbol)) {
    throw new Error(`${fieldName} must be 2-20 chars and match [A-Z0-9._-].`);
  }
  return symbol;
}

function ensureCryptoAccount(db, userId, accountId) {
  const account = db
    .prepare("SELECT id, name, type, currency FROM accounts WHERE user_id = ? AND id = ?")
    .get(userId, accountId);
  if (!account) {
    const error = new Error("Account not found.");
    error.code = "ACCOUNT_NOT_FOUND";
    throw error;
  }
  if (!CRYPTO_ACCOUNT_TYPES.has(String(account.type || ""))) {
    const error = new Error("Account must be crypto_wallet or exchange.");
    error.code = "ACCOUNT_NOT_CRYPTO";
    throw error;
  }
  return account;
}

function mapCryptoTokenPriceRow(row) {
  return {
    symbol: String(row.symbol || ""),
    price: Number(row.price || 0),
    price_currency: normalizeCurrency(row.price_currency || "USD"),
    source: String(row.source || "manual"),
    as_of: row.as_of || null,
    updated_at: row.updated_at || null
  };
}

function mapCryptoPositionRow(row) {
  const quantity = Number(row.quantity || 0);
  const priceRaw = Number(row.price);
  const hasPrice = Number.isFinite(priceRaw) && priceRaw > 0;
  const price = hasPrice ? priceRaw : null;
  const priceCurrency = normalizeCurrency(row.price_currency || "USD");
  const marketValueQuote = hasPrice ? Number((quantity * priceRaw).toFixed(8)) : null;
  return {
    symbol: String(row.symbol || ""),
    quantity,
    price,
    price_currency: priceCurrency,
    price_source: row.price_source || "manual",
    price_as_of: row.as_of || null,
    has_price: hasPrice,
    market_value_quote: marketValueQuote,
    position_updated_at: row.position_updated_at || null,
    price_updated_at: row.price_updated_at || null
  };
}

function buildCryptoPortfolioPayload(db, userId, baseCurrency) {
  const base = normalizeCurrency(baseCurrency || "USD");
  const rows = db
    .prepare(
      `
        SELECT
          p.account_id,
          p.symbol,
          p.quantity,
          p.updated_at AS position_updated_at,
          a.name AS account_name,
          a.type AS account_type,
          a.currency AS account_currency,
          pr.price,
          pr.price_currency,
          pr.source AS price_source,
          pr.as_of,
          pr.updated_at AS price_updated_at
        FROM crypto_positions p
        JOIN accounts a ON a.id = p.account_id
        LEFT JOIN crypto_token_prices pr
          ON pr.user_id = p.user_id AND pr.symbol = p.symbol
        WHERE p.user_id = ? AND a.user_id = ? AND a.type IN ('crypto_wallet', 'exchange')
        ORDER BY p.symbol ASC, p.account_id ASC
      `
    )
    .all(userId, userId);

  let totalMarketValueBase = 0;
  let pricedPositions = 0;
  let unpricedPositions = 0;
  const symbolMap = new Map();
  const positions = rows.map((row) => {
    const normalized = mapCryptoPositionRow(row);
    let marketValueBase = null;
    if (normalized.has_price && normalized.market_value_quote !== null) {
      marketValueBase = convertCurrency(
        normalized.market_value_quote,
        normalized.price_currency,
        base
      );
      totalMarketValueBase += marketValueBase;
      pricedPositions += 1;
    } else {
      unpricedPositions += 1;
    }
    const symbol = normalized.symbol;
    const aggregate = symbolMap.get(symbol) || {
      symbol,
      quantity: 0,
      market_value_base: 0,
      priced_positions: 0,
      unpriced_positions: 0
    };
    aggregate.quantity += normalized.quantity;
    if (marketValueBase !== null) {
      aggregate.market_value_base += marketValueBase;
      aggregate.priced_positions += 1;
    } else {
      aggregate.unpriced_positions += 1;
    }
    symbolMap.set(symbol, aggregate);
    return {
      account_id: row.account_id,
      account_name: row.account_name,
      account_type: row.account_type,
      account_currency: normalizeCurrency(row.account_currency || "USD"),
      ...normalized,
      market_value_base: marketValueBase !== null ? Number(marketValueBase.toFixed(8)) : null
    };
  });

  const bySymbol = [...symbolMap.values()]
    .map((row) => ({
      symbol: row.symbol,
      quantity: Number(row.quantity.toFixed(8)),
      market_value_base: Number(row.market_value_base.toFixed(8)),
      priced_positions: row.priced_positions,
      unpriced_positions: row.unpriced_positions
    }))
    .sort((a, b) => b.market_value_base - a.market_value_base || a.symbol.localeCompare(b.symbol));

  return {
    base_currency: base,
    total_market_value_base: Number(totalMarketValueBase.toFixed(8)),
    positions_count: positions.length,
    priced_positions: pricedPositions,
    unpriced_positions: unpricedPositions,
    by_symbol: bySymbol,
    positions
  };
}

function isActiveL1(db, userId, categoryL1) {
  const row = db
    .prepare("SELECT id FROM expense_category_l1 WHERE user_id = ? AND name = ? AND active = 1")
    .get(userId, categoryL1);
  return Boolean(row);
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
  const prepared = prepareTransactionForWrite(db, userId, payload);
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
      prepared.date,
      prepared.type,
      prepared.amountOriginal,
      prepared.sourceCurrency,
      prepared.fxRate,
      prepared.amountBase,
      prepared.type === "expense" ? prepared.categoryL1 : null,
      prepared.type === "expense" ? prepared.categoryL2 : null,
      prepared.from ? prepared.from.id : null,
      prepared.to ? prepared.to.id : null,
      prepared.type === "transfer" ? prepared.transferReason : null,
      prepared.note
    );
    const txId = Number(result.lastInsertRowid);
    if (prepared.type === "expense") {
      const deltaFrom = convertCurrency(
        prepared.amountOriginal,
        prepared.sourceCurrency,
        normalizeCurrency(prepared.from.currency)
      );
      updateBalance.run(-deltaFrom, prepared.from.id, userId);
    } else if (prepared.type === "income") {
      const deltaTo = convertCurrency(
        prepared.amountOriginal,
        prepared.sourceCurrency,
        normalizeCurrency(prepared.to.currency)
      );
      updateBalance.run(deltaTo, prepared.to.id, userId);
    } else if (prepared.type === "transfer") {
      if (prepared.from) {
        const deltaFrom = convertCurrency(
          prepared.amountOriginal,
          prepared.sourceCurrency,
          normalizeCurrency(prepared.from.currency)
        );
        updateBalance.run(-deltaFrom, prepared.from.id, userId);
      }
      if (prepared.to) {
        const deltaTo = convertCurrency(
          prepared.amountOriginal,
          prepared.sourceCurrency,
          normalizeCurrency(prepared.to.currency)
        );
        updateBalance.run(deltaTo, prepared.to.id, userId);
      }
    }
    for (const tag of prepared.tags) {
      insertTag.run(userId, tag);
      const tagRow = getTag.get(userId, tag);
      attachTag.run(txId, tagRow.id);
    }
    return txId;
  });

  const txId = txn();
  return getTransactionWithTags(db, userId, txId);
}

function prepareTransactionForWrite(db, userId, payload) {
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

  let from =
    payload.account_from_id !== undefined
      ? db
          .prepare("SELECT * FROM accounts WHERE id = ? AND user_id = ?")
          .get(payload.account_from_id, userId)
      : null;
  let to =
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

  if (type === "expense" && !from && payload.account_from_id === undefined) {
    from = getOrCreateUnassignedAccount(db, userId);
  }
  if (type === "income" && !to && payload.account_to_id === undefined) {
    to = getOrCreateUnassignedAccount(db, userId);
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
    if (transferReason === "loan") {
      if (!from) {
        throw new Error("loan transfer requires account_from_id.");
      }
      if (to) {
        throw new Error("loan transfer does not allow account_to_id.");
      }
    } else if (transferReason === "borrow") {
      if (!to) {
        throw new Error("borrow transfer requires account_to_id.");
      }
      if (from) {
        throw new Error("borrow transfer does not allow account_from_id.");
      }
    } else {
      if (!from || !to) {
        throw new Error("Transfer requires account_from_id and account_to_id.");
      }
      if (from.id === to.id) {
        throw new Error("Transfer requires different source and target accounts.");
      }
    }
    if (transferReason === "deposit_lock" && to && to.type !== "restricted_cash") {
      throw new Error("deposit_lock requires destination account type restricted_cash.");
    }
    if (transferReason === "deposit_release" && from && from.type !== "restricted_cash") {
      throw new Error("deposit_release requires source account type restricted_cash.");
    }
  }

  const tags = [...new Set((payload.tags || []).map((x) => String(x).trim()).filter(Boolean))];
  return {
    type,
    date: payload.date,
    amountOriginal,
    fxRate,
    amountBase,
    sourceCurrency,
    from,
    to,
    transferReason,
    categoryL1: payload.category_l1 || null,
    categoryL2: payload.category_l2 || null,
    note: payload.note || "",
    tags
  };
}

function updateTransactionRecord(db, userId, txId, payload) {
  const prepared = prepareTransactionForWrite(db, userId, payload);
  const updateTx = db.prepare(
    `
      UPDATE transactions
      SET
        tx_date = ?,
        type = ?,
        amount_original = ?,
        currency_original = ?,
        fx_rate = ?,
        amount_base = ?,
        category_l1 = ?,
        category_l2 = ?,
        account_from_id = ?,
        account_to_id = ?,
        transfer_reason = ?,
        note = ?
      WHERE id = ? AND user_id = ?
    `
  );
  const clearTags = db.prepare("DELETE FROM transaction_tags WHERE transaction_id = ?");
  const insertTag = db.prepare(
    "INSERT INTO tags (user_id, name) VALUES (?, ?) ON CONFLICT(user_id, name) DO NOTHING"
  );
  const getTag = db.prepare("SELECT id FROM tags WHERE user_id = ? AND name = ?");
  const attachTag = db.prepare(
    "INSERT OR IGNORE INTO transaction_tags (transaction_id, tag_id) VALUES (?, ?)"
  );

  const txn = db.transaction(() => {
    const result = updateTx.run(
      prepared.date,
      prepared.type,
      prepared.amountOriginal,
      prepared.sourceCurrency,
      prepared.fxRate,
      prepared.amountBase,
      prepared.type === "expense" ? prepared.categoryL1 : null,
      prepared.type === "expense" ? prepared.categoryL2 : null,
      prepared.from ? prepared.from.id : null,
      prepared.to ? prepared.to.id : null,
      prepared.type === "transfer" ? prepared.transferReason : null,
      prepared.note,
      txId,
      userId
    );
    if (Number(result.changes || 0) !== 1) {
      throw new Error("Transaction not found.");
    }
    clearTags.run(txId);
    for (const tag of prepared.tags) {
      insertTag.run(userId, tag);
      const tagRow = getTag.get(userId, tag);
      attachTag.run(txId, tagRow.id);
    }
  });
  txn();
  rebuildUserBalances(db, userId);
  return getTransactionWithTags(db, userId, txId);
}

function deleteTransactionRecord(db, userId, txId) {
  const removeTx = db.prepare("DELETE FROM transactions WHERE id = ? AND user_id = ?");
  const txn = db.transaction(() => {
    const result = removeTx.run(txId, userId);
    if (Number(result.changes || 0) !== 1) {
      throw new Error("Transaction not found.");
    }
  });
  txn();
  rebuildUserBalances(db, userId);
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
  const year = String(month || "").slice(0, 4) || new Date().toISOString().slice(0, 4);
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
      amount_base: Number(valueBase.toFixed(2)),
      balance: Number(account.balance),
      currency: normalizeCurrency(account.currency)
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
        SELECT type, amount_base, category_l1
        FROM transactions
        WHERE user_id = ? AND substr(tx_date, 1, 7) = ?
      `
    )
    .all(userId, month);
  let monthlyIncome = 0;
  let monthlyExpense = 0;
  const spentByCategory = new Map();
  for (const tx of monthRows) {
    const converted = Number(tx.amount_base || 0);
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
        SELECT category_l1, total_amount, budget_currency
        FROM budgets
        WHERE user_id = ? AND month = ?
        ORDER BY category_l1
      `
    )
    .all(userId, month);
  const budgetStatus = budgetRows.map((row) => {
    const spent = Number(spentByCategory.get(row.category_l1) || 0);
    const total = convertCurrency(
      Number(row.total_amount || 0),
      normalizeCurrency(row.budget_currency || baseCurrency),
      baseCurrency
    );
    return {
      category_l1: row.category_l1,
      total_amount: total,
      spent_amount: spent,
      remaining_amount: total - spent,
      overspend: spent > total
    };
  });

  const yearExpenseRows = db
    .prepare(
      `
        SELECT category_l1, amount_base
        FROM transactions
        WHERE user_id = ? AND type = 'expense' AND substr(tx_date, 1, 4) = ?
      `
    )
    .all(userId, year);
  const spentByCategoryYearly = new Map();
  for (const tx of yearExpenseRows) {
    const converted = Number(tx.amount_base || 0);
    spentByCategoryYearly.set(
      tx.category_l1,
      (spentByCategoryYearly.get(tx.category_l1) || 0) + converted
    );
  }
  const yearlyBudgetRows = db
    .prepare(
      `
        SELECT category_l1, total_amount, budget_currency
        FROM yearly_budgets
        WHERE user_id = ? AND year = ?
        ORDER BY category_l1
      `
    )
    .all(userId, Number.parseInt(year, 10));
  const budgetStatusYearly = yearlyBudgetRows.map((row) => {
    const spent = Number(spentByCategoryYearly.get(row.category_l1) || 0);
    const total = convertCurrency(
      Number(row.total_amount || 0),
      normalizeCurrency(row.budget_currency || baseCurrency),
      baseCurrency
    );
    return {
      category_l1: row.category_l1,
      total_amount: total,
      spent_amount: spent,
      remaining_amount: total - spent,
      overspend: spent > total
    };
  });

  const burnRate = computeBurnRate(db, userId);
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
    budget_status: budgetStatus,
    budget_status_yearly: budgetStatusYearly
  };
}

function computeBurnRate(db, userId) {
  const rows = db
    .prepare(
      `
        SELECT substr(tx_date, 1, 7) AS month, type, amount_base
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
    const converted = Number(row.amount_base || 0);
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
        SELECT substr(tx_date, 1, 7) AS month, amount_base
        FROM transactions
        WHERE user_id = ? AND type = 'income'
      `
    )
    .all(userId);
  const incomeByMonth = new Map();
  for (const row of incomeTxRows) {
    const converted = Number(row.amount_base || 0);
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
        SELECT category_l2, amount_base
        FROM transactions
        WHERE user_id = ? AND type = 'expense' AND substr(tx_date, 1, 7) = ?
      `
    )
    .all(userId, month);
  let fixedCostInMonth = 0;
  let totalExpenseInMonth = 0;
  for (const row of expenseRows) {
    const converted = Number(row.amount_base || 0);
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
        SELECT id, tx_date, type, amount_base, category_l1, category_l2, note
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
    const converted = Number(row.amount_base || 0);
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

function requireSessionAuth(req, res, next) {
  if (req.authMethod !== "session") {
    return res.status(401).json({ error: "Session authentication required." });
  }
  return next();
}

function createAgentTokenString() {
  return `nfat_${randomToken()}`;
}

function normalizeAgentScopes(rawScopes) {
  const list = Array.isArray(rawScopes) && rawScopes.length ? rawScopes : DEFAULT_AGENT_SCOPES;
  return [...new Set(list.map((scope) => String(scope || "").trim()).filter((scope) => ALLOWED_AGENT_SCOPES.has(scope)))];
}

function parseScopesJson(raw) {
  try {
    const parsed = JSON.parse(String(raw || "[]"));
    if (!Array.isArray(parsed)) return [];
    return normalizeAgentScopes(parsed);
  } catch {
    return [];
  }
}

function extractBearerToken(req) {
  const raw = String(req.header("authorization") || "").trim();
  if (!raw) return "";
  const [scheme, token] = raw.split(/\s+/, 2);
  if (String(scheme || "").toLowerCase() !== "bearer") return "";
  return String(token || "").trim();
}

function resolveApiToken(db, rawToken) {
  const tokenHash = hashToken(rawToken);
  const row = db
    .prepare(
      `
        SELECT id, user_id, token_prefix, scopes_json, revoked
        FROM auth_api_tokens
        WHERE token_hash = ?
      `
    )
    .get(tokenHash);
  if (!row) return null;
  if (Number(row.revoked || 0) !== 0) return null;
  const scopes = parseScopesJson(row.scopes_json);
  if (!scopes.length) return null;
  db.prepare("UPDATE auth_api_tokens SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?").run(row.id);
  return {
    id: row.id,
    user_id: row.user_id,
    token_prefix: row.token_prefix || "",
    scopes
  };
}

function hasScope(scopes, requiredScope) {
  if (!requiredScope) return true;
  if (!Array.isArray(scopes)) return false;
  return scopes.includes(requiredScope);
}

function resolveRequiredScope(req) {
  const method = String(req.method || "GET").toUpperCase();
  const path = String(req.path || "");
  if (!path.startsWith("/api/v1/")) return null;
  if (
    path === "/api/v1/auth/code/request" ||
    path === "/api/v1/auth/code/verify" ||
    path === "/api/v1/auth/magic-link/request" ||
    path === "/api/v1/auth/session" ||
    path === "/api/v1/auth/logout" ||
    path.startsWith("/api/v1/auth/agent-tokens")
  ) {
    return null;
  }
  if (path === "/api/v1/settings") {
    return method === "GET" ? "settings:read" : "settings:write";
  }
  if (path.startsWith("/api/v1/fx/")) {
    return "settings:read";
  }
  if (path === "/api/v1/categories") return "categories:read";
  if (path.startsWith("/api/v1/categories/")) return method === "GET" ? "categories:read" : "categories:write";
  if (path === "/api/v1/accounts") return method === "GET" ? "accounts:read" : "accounts:write";
  if (path.startsWith("/api/v1/accounts/")) return method === "GET" ? "accounts:read" : "accounts:write";
  if (path.startsWith("/api/v1/crypto/")) return method === "GET" ? "accounts:read" : "accounts:write";
  if (path === "/api/v1/admin/rebuild-balances") return "admin:rebuild-balances";
  if (path === "/api/v1/tags") return "tags:read";
  if (path === "/api/v1/transactions") return method === "GET" ? "transactions:read" : "transactions:write";
  if (path.startsWith("/api/v1/transactions/")) return method === "GET" ? "transactions:read" : "transactions:write";
  if (path === "/api/v1/budgets" || path === "/api/v1/budgets/yearly") {
    return method === "GET" ? "budgets:read" : "budgets:write";
  }
  if (path === "/api/v1/dashboard") return "dashboard:read";
  if (path.startsWith("/api/v1/metrics/")) return "metrics:read";
  if (path === "/api/v1/reviews/monthly") return "reviews:read";
  if (path === "/api/v1/reviews/monthly/generate") return "reviews:write";
  if (path === "/api/v1/export/transactions.csv") return "export:read";
  if (path === "/api/v1/analytics/summary") return "analytics:read";
  return "__unmapped_scope__";
}

function parseUserIdForLog(rawUserId) {
  const parsed = Number.parseInt(String(rawUserId || ""), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function summarizeErrorForLog(error) {
  if (typeof error === "string") return error.slice(0, 280);
  if (!error) return "";
  if (typeof error === "object" && typeof error.message === "string") {
    return error.message.slice(0, 280);
  }
  try {
    return JSON.stringify(error).slice(0, 280);
  } catch {
    return String(error).slice(0, 280);
  }
}

function resolveFxErrorStatus(error) {
  return String(error?.code || "") === "FX_QUOTE_UNAVAILABLE" ? 503 : 500;
}

function formatFxError(error) {
  const baseMessage = String(error?.message || "FX quote unavailable.");
  const providerErrors = Array.isArray(error?.provider_errors)
    ? error.provider_errors.filter(Boolean).slice(0, 2)
    : [];
  if (!providerErrors.length) return baseMessage;
  return `${baseMessage} Providers: ${providerErrors.join(" | ")}`;
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
  const rate = peekRecentRate(from, to, FX_CONVERT_MAX_AGE_MS);
  if (!Number.isFinite(Number(rate)) || Number(rate) <= 0) {
    const error = new Error(`FX quote unavailable for ${from}->${to}.`);
    error.code = "FX_QUOTE_UNAVAILABLE";
    throw error;
  }
  return Number((numeric * Number(rate)).toFixed(8));
}

async function getCachedFxRate(fromCurrency, toCurrency) {
  const from = normalizeCurrency(fromCurrency || "USD");
  const to = normalizeCurrency(toCurrency || "USD");
  if (from === to) return 1;
  const key = `${from}->${to}`;
  const now = Date.now();
  const cached = FX_RATE_CACHE.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.rate;
  }
  const quote = await fetchFxRate(from, to);
  const rate = Number(quote?.rate);
  if (!Number.isFinite(rate) || rate <= 0) {
    const error = new Error(`Invalid FX quote for ${from}->${to}.`);
    error.code = "FX_QUOTE_UNAVAILABLE";
    throw error;
  }
  const safeRate = Number(rate);
  FX_RATE_CACHE.set(key, { rate: safeRate, expiresAt: now + FX_RATE_CACHE_TTL_MS });
  const inverse = 1 / safeRate;
  if (Number.isFinite(inverse) && inverse > 0) {
    FX_RATE_CACHE.set(`${to}->${from}`, {
      rate: Number(inverse.toFixed(8)),
      expiresAt: now + FX_RATE_CACHE_TTL_MS
    });
  }
  return safeRate;
}

async function ensureFxPairsLoaded(pairs) {
  const deduped = new Set();
  for (const pair of pairs || []) {
    if (!Array.isArray(pair) || pair.length !== 2) continue;
    const from = normalizeCurrency(pair[0] || "USD");
    const to = normalizeCurrency(pair[1] || "USD");
    if (from === to) continue;
    deduped.add(`${from}->${to}`);
  }
  await Promise.all(
    Array.from(deduped).map(async (pair) => {
      const [from, to] = pair.split("->");
      await getCachedFxRate(from, to);
    })
  );
}

function collectAllUserCurrencies(db, userId) {
  const currencies = new Set();
  for (const row of db.prepare("SELECT DISTINCT currency FROM accounts WHERE user_id = ?").all(userId)) {
    currencies.add(normalizeCurrency(row.currency || "USD"));
  }
  for (const row of db.prepare("SELECT DISTINCT budget_currency FROM budgets WHERE user_id = ?").all(userId)) {
    currencies.add(normalizeCurrency(row.budget_currency || "USD"));
  }
  for (const row of db.prepare("SELECT DISTINCT budget_currency FROM yearly_budgets WHERE user_id = ?").all(userId)) {
    currencies.add(normalizeCurrency(row.budget_currency || "USD"));
  }
  currencies.add("USD");
  return currencies;
}

async function ensureBaseFxCoverage(db, userId, baseCurrency) {
  const base = normalizeCurrency(baseCurrency || "USD");
  const currencies = collectAllUserCurrencies(db, userId);
  const pairs = [];
  for (const currency of currencies) {
    if (!currency || currency === base) continue;
    pairs.push([currency, base]);
  }
  await ensureFxPairsLoaded(pairs);
}

async function ensureCryptoPortfolioFxCoverage(db, userId, baseCurrency) {
  const base = normalizeCurrency(baseCurrency || "USD");
  const rows = db
    .prepare("SELECT DISTINCT price_currency FROM crypto_token_prices WHERE user_id = ?")
    .all(userId);
  const pairs = [];
  for (const row of rows) {
    const quote = normalizeCurrency(row.price_currency || "USD");
    if (quote === base) continue;
    pairs.push([quote, base]);
  }
  await ensureFxPairsLoaded(pairs);
}

async function ensureRebuildFxCoverage(db, userId) {
  const accountRows = db.prepare("SELECT DISTINCT currency FROM accounts WHERE user_id = ?").all(userId);
  const txRows = db
    .prepare("SELECT DISTINCT currency_original FROM transactions WHERE user_id = ?")
    .all(userId);
  const accountCurrencies = new Set(accountRows.map((row) => normalizeCurrency(row.currency || "USD")));
  const txCurrencies = new Set(txRows.map((row) => normalizeCurrency(row.currency_original || "USD")));
  const pairs = [];
  for (const source of txCurrencies) {
    for (const target of accountCurrencies) {
      if (source === target) continue;
      pairs.push([source, target]);
    }
  }
  await ensureFxPairsLoaded(pairs);
}

async function revalueTransactionsToBaseCurrency(db, userId, targetBaseCurrency) {
  const targetBase = normalizeCurrency(targetBaseCurrency || "USD");
  const txRows = db
    .prepare("SELECT id, amount_original, currency_original FROM transactions WHERE user_id = ? ORDER BY id")
    .all(userId);
  if (!txRows.length) return { updated: 0 };

  const uniqueSources = new Set();
  for (const row of txRows) {
    const source = normalizeCurrency(row.currency_original || targetBase);
    if (source !== targetBase) uniqueSources.add(source);
  }

  const rateBySource = new Map([[targetBase, 1]]);
  await Promise.all(
    Array.from(uniqueSources).map(async (source) => {
      const rate = await getCachedFxRate(source, targetBase);
      rateBySource.set(source, Number(rate));
    })
  );

  const update = db.prepare(
    "UPDATE transactions SET fx_rate = ?, amount_base = ? WHERE id = ? AND user_id = ?"
  );
  const save = db.transaction(() => {
    for (const row of txRows) {
      const source = normalizeCurrency(row.currency_original || targetBase);
      const amountOriginal = Number(row.amount_original || 0);
      const fxRate = Number(rateBySource.get(source) || 1);
      if (!Number.isFinite(fxRate) || fxRate <= 0) {
        const error = new Error(`FX quote unavailable for ${source}->${targetBase}.`);
        error.code = "FX_QUOTE_UNAVAILABLE";
        throw error;
      }
      const amountBase = Number((amountOriginal * fxRate).toFixed(8));
      update.run(fxRate, amountBase, row.id, userId);
    }
  });
  save();
  return { updated: txRows.length };
}

async function ensurePayloadFxCoverage(db, userId, payload) {
  const source = normalizeCurrency(payload?.currency_original || "USD");
  const pairs = [];
  const fromId = Number(payload?.account_from_id || 0);
  const toId = Number(payload?.account_to_id || 0);
  if (Number.isInteger(fromId) && fromId > 0) {
    const from = db.prepare("SELECT currency FROM accounts WHERE user_id = ? AND id = ?").get(userId, fromId);
    if (from?.currency) pairs.push([source, normalizeCurrency(from.currency)]);
  }
  if (Number.isInteger(toId) && toId > 0) {
    const to = db.prepare("SELECT currency FROM accounts WHERE user_id = ? AND id = ?").get(userId, toId);
    if (to?.currency) pairs.push([source, normalizeCurrency(to.currency)]);
  }
  await ensureFxPairsLoaded(pairs);
}

function computeAccountTxDelta(db, userId, accountId, accountCurrency) {
  const rows = db
    .prepare(
      `
        SELECT type, amount_original, currency_original, account_from_id, account_to_id
        FROM transactions
        WHERE user_id = ? AND (account_from_id = ? OR account_to_id = ?)
        ORDER BY id
      `
    )
    .all(userId, accountId, accountId);
  let delta = 0;
  for (const tx of rows) {
    const amountOriginal = Number(tx.amount_original || 0);
    const sourceCurrency = normalizeCurrency(tx.currency_original || "USD");
    const converted = convertCurrency(amountOriginal, sourceCurrency, accountCurrency);
    if (tx.type === "expense" && tx.account_from_id === accountId) {
      delta -= converted;
    } else if (tx.type === "income" && tx.account_to_id === accountId) {
      delta += converted;
    } else if (tx.type === "transfer") {
      if (tx.account_from_id === accountId) delta -= converted;
      if (tx.account_to_id === accountId) delta += converted;
    }
  }
  return Number(delta.toFixed(8));
}

function countLinkedTransactions(db, userId, accountId) {
  const row = db
    .prepare(
      `
        SELECT COUNT(*) AS count
        FROM transactions
        WHERE user_id = ? AND (account_from_id = ? OR account_to_id = ?)
      `
    )
    .get(userId, accountId, accountId);
  return Number(row?.count || 0);
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

function parseEnvBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function randomToken() {
  return randomBytes(32).toString("base64url");
}

function randomAuthCode() {
  const min = 10 ** (AUTH_CODE_LENGTH - 1);
  const maxExclusive = 10 ** AUTH_CODE_LENGTH;
  return String(randomInt(min, maxExclusive));
}

function hashToken(value) {
  return createHash("sha256").update(String(value || "")).digest("hex");
}

function hashAuthCode(email, code) {
  return hashToken(`${normalizeEmail(email)}:${String(code || "").trim()}`);
}

function consumeRateLimit(store, key, windowMs, maxHits) {
  const safeKey = String(key || "").trim();
  if (!safeKey) return false;
  const now = Date.now();
  const threshold = now - Math.max(1, Number(windowMs) || 1);
  const limit = Math.max(1, Number(maxHits) || 1);
  const prior = Array.isArray(store.get(safeKey))
    ? store.get(safeKey)
    : [];
  const recent = prior.filter((time) => Number(time) > threshold);
  if (recent.length >= limit) {
    store.set(safeKey, recent);
    return false;
  }
  recent.push(now);
  store.set(safeKey, recent);
  return true;
}

function extractClientIp(req) {
  const forwarded = String(req.header("x-forwarded-for") || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)[0];
  return forwarded || req.ip || req.socket?.remoteAddress || "";
}

function resolveAppBaseUrl(req) {
  const configured = String(process.env.APP_BASE_URL || "").trim();
  if (configured) return configured.replace(/\/+$/, "");
  const protocol = req.protocol || "http";
  const host = req.get("host") || "localhost:5001";
  return `${protocol}://${host}`;
}

function getCookie(req, name) {
  const cookies = parseCookies(req.header("cookie"));
  return cookies[String(name || "")] || "";
}

function parseCookies(rawCookieHeader) {
  const output = {};
  const raw = String(rawCookieHeader || "");
  if (!raw) return output;
  for (const piece of raw.split(";")) {
    const segment = piece.trim();
    if (!segment) continue;
    const index = segment.indexOf("=");
    if (index <= 0) continue;
    const key = segment.slice(0, index).trim();
    const value = segment.slice(index + 1).trim();
    if (!key) continue;
    try {
      output[key] = decodeURIComponent(value);
    } catch {
      output[key] = value;
    }
  }
  return output;
}

function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(String(value || ""))}`];
  parts.push(`Path=${options.path || "/"}`);
  if (Number.isFinite(Number(options.maxAgeSec))) {
    parts.push(`Max-Age=${Math.max(0, Math.floor(Number(options.maxAgeSec)))}`);
  }
  if (options.httpOnly !== false) parts.push("HttpOnly");
  parts.push(`SameSite=${options.sameSite || "Lax"}`);
  if (options.secure) parts.push("Secure");
  return parts.join("; ");
}

function isSecureCookieRequest(req) {
  if (process.env.NODE_ENV === "production") return true;
  return Boolean(req.secure);
}

function issueSessionCookie(db, req, res, userId) {
  const sessionToken = randomToken();
  const sessionHash = hashToken(sessionToken);
  const expiresAt = new Date(Date.now() + AUTH_SESSION_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  db.prepare(
    `
      INSERT INTO auth_sessions (user_id, session_hash, expires_at, revoked, last_seen_at)
      VALUES (?, ?, ?, 0, CURRENT_TIMESTAMP)
    `
  ).run(userId, sessionHash, expiresAt);
  res.setHeader(
    "Set-Cookie",
    serializeCookie(SESSION_COOKIE_NAME, sessionToken, {
      maxAgeSec: AUTH_SESSION_TTL_DAYS * 24 * 60 * 60,
      httpOnly: true,
      sameSite: "Lax",
      secure: isSecureCookieRequest(req),
      path: "/"
    })
  );
}

function revokePendingAuthEmailCodes(db, userId) {
  db.prepare(
    `
      UPDATE auth_email_codes
      SET revoked = 1
      WHERE user_id = ? AND used_at IS NULL AND revoked = 0
    `
  ).run(userId);
}

function consumeAuthEmailCode(db, email, code) {
  const normalizedEmail = normalizeEmail(email);
  const codeHash = hashAuthCode(normalizedEmail, code);
  const row = db
    .prepare(
      `
        SELECT id, user_id, expires_at, used_at, revoked
        FROM auth_email_codes
        WHERE email_normalized = ? AND code_hash = ?
        ORDER BY id DESC
      `
    )
    .get(normalizedEmail, codeHash);
  if (!row) return null;
  if (Number(row.revoked || 0) !== 0) return null;
  if (row.used_at) return null;
  const expiresAt = Date.parse(String(row.expires_at || ""));
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
  const updated = db
    .prepare(
      `
        UPDATE auth_email_codes
        SET used_at = CURRENT_TIMESTAMP
        WHERE id = ? AND used_at IS NULL AND revoked = 0
      `
    )
    .run(row.id);
  if (!Number(updated.changes || 0)) return null;
  return row;
}

function revokePendingMagicLinks(db, userId) {
  db.prepare(
    `
      UPDATE auth_magic_links
      SET revoked = 1
      WHERE user_id = ? AND used_at IS NULL AND revoked = 0
    `
  ).run(userId);
}

function consumeMagicLink(db, token) {
  const tokenHash = hashToken(token);
  const row = db
    .prepare(
      `
        SELECT id, user_id, expires_at, used_at, revoked
        FROM auth_magic_links
        WHERE token_hash = ?
      `
    )
    .get(tokenHash);
  if (!row) return null;
  if (Number(row.revoked || 0) !== 0) return null;
  if (row.used_at) return null;
  const expiresAt = Date.parse(String(row.expires_at || ""));
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
  const updated = db
    .prepare(
      `
        UPDATE auth_magic_links
        SET used_at = CURRENT_TIMESTAMP
        WHERE id = ? AND used_at IS NULL AND revoked = 0
      `
    )
    .run(row.id);
  if (!Number(updated.changes || 0)) return null;
  return row;
}

function resolveSession(db, sessionToken) {
  const hash = hashToken(sessionToken);
  const row = db
    .prepare(
      `
        SELECT s.id, s.user_id, s.expires_at, s.revoked, u.email
        FROM auth_sessions s
        JOIN users u ON u.id = s.user_id
        WHERE s.session_hash = ?
      `
    )
    .get(hash);
  if (!row) return null;
  if (Number(row.revoked || 0) !== 0) return null;
  const expiresAt = Date.parse(String(row.expires_at || ""));
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    db.prepare(
      `
        UPDATE auth_sessions
        SET revoked = 1, last_seen_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `
    ).run(row.id);
    return null;
  }
  db.prepare("UPDATE auth_sessions SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?").run(row.id);
  return row;
}

async function sendAuthCodeEmail(email, code) {
  const resendApiKey = String(process.env.RESEND_API_KEY || "").trim();
  const resendFrom = String(process.env.RESEND_FROM_EMAIL || "").trim();
  if (!resendApiKey || !resendFrom) {
    console.log(`[auth-code] resend not configured. email=${email} code=${code}`);
    return;
  }
  const subject = "Your Nomad Finance OS verification code";
  const text = [
    "Use the verification code below to sign in to Nomad Finance OS:",
    code,
    "",
    `This code expires in ${AUTH_CODE_TTL_MINUTES} minutes.`
  ].join("\n");
  const html = `
    <div style="font-family: -apple-system, Segoe UI, sans-serif; line-height: 1.5; color: #1f2d38;">
      <p>Use this verification code to sign in to <strong>Nomad Finance OS</strong>:</p>
      <p style="font-size: 28px; letter-spacing: 4px; font-weight: 700;">${escapeHtml(code)}</p>
      <p>This code expires in ${AUTH_CODE_TTL_MINUTES} minutes.</p>
    </div>
  `;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resendApiKey}`
    },
    body: JSON.stringify({
      from: resendFrom,
      to: [email],
      subject,
      text,
      html
    })
  });
  if (!response.ok) {
    const payload = await safeJsonParse(response);
    const error = new Error(
      `Verification code email failed (${response.status}): ${summarizeErrorForLog(payload?.message || payload?.error || payload)}`
    );
    error.status = response.status;
    throw error;
  }
}

async function safeJsonParse(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderAuthResultHtml(ok, message) {
  const safeMessage = escapeHtml(message || "");
  const title = ok ? "Login Success" : "Login Failed";
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      body { font-family: -apple-system, Segoe UI, sans-serif; padding: 24px; background: #f0f3f5; color: #1f2d38; }
      .card { max-width: 560px; margin: 0 auto; padding: 16px; border: 1px solid #d4dde4; border-radius: 12px; background: #ffffff; }
    </style>
  </head>
  <body>
    <div class="card">
      <h2>${escapeHtml(title)}</h2>
      <p>${safeMessage}</p>
      <p><a href="/">Back to app</a></p>
    </div>
  </body>
</html>`;
}

module.exports = {
  createApp,
  buildMonthlySummary,
  buildMonthlyReviewPayload
};
