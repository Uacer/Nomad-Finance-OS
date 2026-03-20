const fs = require("node:fs");
const path = require("node:path");

loadEnvFile(path.join(__dirname, "..", ".env"));
const { createDb } = require("./db");
const { createApp } = require("./app");
const { SUPPORTED_CURRENCIES } = require("./constants");
const { refreshRecentFxCache } = require("./fx");

const dbPath = process.env.DB_PATH || path.join(__dirname, "..", "nomad-finance.db");
const db = createDb(dbPath);
const app = createApp(db);
const fxRefreshIntervalMs = Math.max(
  60 * 60 * 1000,
  Number.parseInt(String(process.env.FX_REFRESH_INTERVAL_MS || `${24 * 60 * 60 * 1000}`), 10) ||
    24 * 60 * 60 * 1000
);

const port = Number.parseInt(process.env.PORT || "5001", 10);
app.listen(port, "0.0.0.0", () => {
  console.log(`Nomad Finance OS API running on http://localhost:${port}`);
  void runFxRefresh("startup");
  const timer = setInterval(() => {
    void runFxRefresh("interval");
  }, fxRefreshIntervalMs);
  if (typeof timer.unref === "function") timer.unref();
});

async function runFxRefresh(reason) {
  try {
    const result = await refreshRecentFxCache(SUPPORTED_CURRENCIES);
    console.log(
      JSON.stringify({
        event: "fx_refresh",
        reason,
        interval_ms: fxRefreshIntervalMs,
        total: result.total,
        success: result.success,
        failed: result.failed,
        errors: result.errors
      })
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "fx_refresh_error",
        reason,
        interval_ms: fxRefreshIntervalMs,
        error: String(error?.message || error)
      })
    );
  }
}

function loadEnvFile(filename) {
  if (!fs.existsSync(filename)) return;
  const lines = fs.readFileSync(filename, "utf8").split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (!key || process.env[key] !== undefined) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}
