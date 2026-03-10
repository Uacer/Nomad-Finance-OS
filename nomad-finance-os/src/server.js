const path = require("node:path");
const { createDb } = require("./db");
const { createApp } = require("./app");

const dbPath = process.env.DB_PATH || path.join(__dirname, "..", "nomad-finance.db");
const db = createDb(dbPath);
const app = createApp(db);

const port = Number.parseInt(process.env.PORT || "5001", 10);
app.listen(port, () => {
  console.log(`Nomad Finance OS API running on http://localhost:${port}`);
});
