const fs = require("node:fs");
const path = require("node:path");

function timestamp() {
  return new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
}

function run() {
  const backupFileArg = process.env.BACKUP_FILE || process.argv[2];
  if (!backupFileArg) {
    throw new Error("Missing backup file path. Provide BACKUP_FILE or first CLI argument.");
  }
  const backupFile = path.resolve(backupFileArg);
  if (!fs.existsSync(backupFile)) {
    throw new Error(`Backup file not found: ${backupFile}`);
  }

  const dbPath = path.resolve(
    process.env.DB_PATH || path.join(__dirname, "..", "nomad-finance.db")
  );
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const currentExists = fs.existsSync(dbPath);
  let previousPath = null;
  if (currentExists) {
    previousPath = `${dbPath}.pre-restore-${timestamp()}`;
    fs.copyFileSync(dbPath, previousPath);
  }

  const tempTarget = `${dbPath}.restore-tmp`;
  fs.copyFileSync(backupFile, tempTarget);
  fs.renameSync(tempTarget, dbPath);

  console.log(
    JSON.stringify({
      ok: true,
      backup_file: backupFile,
      restored_to: dbPath,
      previous_db_backup: previousPath
    })
  );
}

try {
  run();
} catch (error) {
  console.error(error);
  process.exit(1);
}
