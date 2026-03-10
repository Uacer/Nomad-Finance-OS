const fs = require("node:fs");
const path = require("node:path");
const Database = require("better-sqlite3");

function timestamp() {
  return new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
}

async function run() {
  const dbPath = path.resolve(
    process.env.DB_PATH || path.join(__dirname, "..", "nomad-finance.db")
  );
  const backupDir = path.resolve(
    process.env.BACKUP_DIR || path.join(__dirname, "..", "backups")
  );
  fs.mkdirSync(backupDir, { recursive: true });

  const outputPath = path.join(backupDir, `nomad-finance-${timestamp()}.db`);
  const db = new Database(dbPath);
  await db.backup(outputPath);
  db.close();

  console.log(
    JSON.stringify({
      ok: true,
      db_path: dbPath,
      backup_path: outputPath
    })
  );
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
