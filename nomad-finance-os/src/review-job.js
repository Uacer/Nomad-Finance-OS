const path = require("node:path");
const { createDb, normalizeMonth } = require("./db");
const { buildMonthlyReviewPayload } = require("./app");

function monthOffset(currentMonth, offset) {
  const [year, month] = currentMonth.split("-").map((x) => Number(x));
  const d = new Date(Date.UTC(year, month - 1 + offset, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function parseCliArg(name) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((x) => x.startsWith(prefix));
  if (!arg) return null;
  return arg.slice(prefix.length);
}

function run() {
  const dbPath = process.env.DB_PATH || path.join(__dirname, "..", "nomad-finance.db");
  const db = createDb(dbPath);
  const nowMonth = new Date().toISOString().slice(0, 7);
  const month = normalizeMonth(parseCliArg("month") || monthOffset(nowMonth, -1));
  const userRows = db.prepare("SELECT id FROM users ORDER BY id").all();

  const upsert = db.prepare(
    `
      INSERT INTO monthly_review_snapshots (user_id, month, payload_json, summary)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, month)
      DO UPDATE SET payload_json = excluded.payload_json, summary = excluded.summary, created_at = CURRENT_TIMESTAMP
    `
  );

  for (const row of userRows) {
    const payload = buildMonthlyReviewPayload(db, row.id, month);
    upsert.run(row.id, month, JSON.stringify(payload), payload.summary);
  }

  console.log(
    JSON.stringify({
      ok: true,
      month,
      users_processed: userRows.length
    })
  );
  db.close();
}

if (require.main === module) {
  run();
}

module.exports = {
  run
};
