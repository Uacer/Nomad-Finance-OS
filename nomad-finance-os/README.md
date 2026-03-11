# Nomad Finance OS (MVP Backend)

Web-first MVP backend implementing:

- Expense with `category_l1 + category_l2 + tags`
- Budget control at `category_l1` level
- Yearly budgets
- Restricted cash accounting for deposits (`deposit_lock`, `deposit_release`)
- Dashboard with `restricted_cash_total`
- Runway and risk metrics
- Monthly review separating transfers from real expense + snapshot generation
- BYOK AI providers (OpenAI-compatible endpoint) + parse text/image draft + confirm extraction
- Capture parse is AI-only: an active default provider is required (no heuristic fallback)
- FX quote endpoint and auto conversion to base currency
- Product event tracking + analytics summary endpoint
- Account balances tracked in each account's own currency, while dashboard metrics are unified into base currency
- Dashboard/Review/Budget spent calculations are dynamically recomputed in current base currency from original transaction currency

## Budget

- `Budget`: spending limit by category and period (monthly/yearly), used for overspend control.

## Crypto Exposure Formula

`crypto_exposure = crypto_positive_asset_value / total_positive_asset_value`

- Uses only positive asset balances (converted to current base currency).
- Clamped to `[0, 1]`, so it will not become negative when net worth is negative.

## Quick Start

```bash
cd nomad-finance-os
npm install
npm start
```

Server default: `http://localhost:5001`

Open `http://localhost:5001` for the mobile-first UI.

Optional env:

- `CREDENTIAL_SECRET`: encryption secret for stored BYOK provider API keys
- `DB_PATH`: SQLite path (defaults to `nomad-finance.db`)
- `BACKUP_DIR`: backup output directory (defaults to `backups`)
- `PORT`: API port (defaults to `5001`)

## Test

```bash
cd nomad-finance-os
npm test
```

## Monthly Review Job

Generate previous month snapshot for all users:

```bash
cd nomad-finance-os
npm run generate:monthly-review
```

Generate a specific month:

```bash
cd nomad-finance-os
npm run generate:monthly-review -- --month=2026-03
```

## Backup & Restore

Create a consistent SQLite backup:

```bash
cd nomad-finance-os
npm run backup:db
```

Restore from a backup file:

```bash
cd nomad-finance-os
BACKUP_FILE=./backups/nomad-finance-2026-03-10T11-30-00-000Z.db npm run restore:db
```

## Docker

Build and run with Docker Compose:

```bash
cd nomad-finance-os
docker compose up -d --build
```

The container exposes `http://localhost:5001` and persists:

- DB volume: `/data`
- Backup volume: `/backups`

Run backup inside container:

```bash
cd nomad-finance-os
docker compose exec app npm run backup:db
```

Stop:

```bash
cd nomad-finance-os
docker compose down
```

## Scheduled Ops

Sample cron entries are provided at `ops/cron/backup.cron`:

- Daily DB backup at 02:10
- Monthly review snapshot generation on day 1 at 09:00

## Deployment Notes

- Current implementation uses SQLite for MVP speed.
- For production, deploy as a long-running container with persistent volume (Docker host, Render, Railway, Fly.io, VM).
- Vercel + Neon migration is possible but requires replacing the SQLite data layer with a Postgres adapter.

## API (core)

- `GET /api/v1/settings`
- `PUT /api/v1/settings`
- `GET /api/v1/fx/quote`
- `GET /api/v1/fx/supported-currencies`
- `GET /api/v1/categories`
- `POST /api/v1/categories/l1`
- `PATCH /api/v1/categories/l1/:name`
- `POST /api/v1/categories/l2`
- `POST /api/v1/accounts`
- `GET /api/v1/accounts`
- `POST /api/v1/admin/rebuild-balances`
- `GET /api/v1/tags`
- `POST /api/v1/ai/providers`
- `GET /api/v1/ai/providers`
- `PATCH /api/v1/ai/providers/:id`
- `DELETE /api/v1/ai/providers/:id`
- `POST /api/v1/ai/providers/:id/validate`
- `POST /api/v1/ai/providers/:id/set-default`
- `POST /api/v1/transactions/parse-text`
- `POST /api/v1/transactions/parse-image`
- `POST /api/v1/transactions/confirm-extraction`
- `POST /api/v1/transactions`
- `GET /api/v1/transactions`
- `POST /api/v1/budgets`
- `GET /api/v1/budgets`
- `POST /api/v1/budgets/yearly`
- `GET /api/v1/budgets/yearly`
- `GET /api/v1/dashboard`
- `GET /api/v1/metrics/runway`
- `GET /api/v1/metrics/risk`
- `GET /api/v1/reviews/monthly`
- `POST /api/v1/reviews/monthly/generate`
- `GET /api/v1/export/transactions.csv`
- `GET /api/v1/analytics/summary`

Use `x-user-id` header to simulate multi-user data isolation (defaults to `1` if omitted).
