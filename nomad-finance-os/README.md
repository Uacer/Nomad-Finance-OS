# Nomad Finance OS (MVP Backend)

Web-first MVP backend implementing:

- Expense with `category_l1 + category_l2 + tags`
- Budget control at `category_l1` level
- Yearly budgets
- Restricted cash accounting for deposits (`deposit_lock`, `deposit_release`)
- Dashboard with `restricted_cash_total`
- Runway and risk metrics
- Monthly review separating transfers from real expense + snapshot generation
- Built-in AI agent (OpenAI-compatible endpoint) + parse text/image draft + confirm extraction
- Capture parse is AI-only and uses server-side agent config (no per-user provider setup)
- FX quote endpoint and auto conversion to base currency
- Fixed currency list for MVP: `CNY, EUR, THB, USD, JPY, KRW`
- UI language setting: `en` / `zh` (persisted per user)
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

- `NOMAD_AGENT_API_KEY` or `OPENAI_API_KEY`: API key for server-side AI agent (required for parse APIs)
- `NOMAD_AGENT_BASE_URL` or `OPENAI_BASE_URL`: OpenAI-compatible base URL (defaults to `https://api.openai.com/v1`)
- `NOMAD_AGENT_MODEL` or `OPENAI_MODEL`: model name (defaults to `gpt-4o-mini`)
- `DB_PATH`: SQLite path (defaults to `nomad-finance.db`)
- `BACKUP_DIR`: backup output directory (defaults to `backups`)
- `PORT`: API port (defaults to `5001`)
- `EXCHANGERATE_HOST_ACCESS_KEY`: optional API key for `exchangerate.host` live FX endpoint
- `AUTH_ALLOW_DEV_BYPASS`: set `true` only for local dev `x-user-id` bypass (defaults to `false`)

FX provider priority:

1. `exchangerate.host/live` (when `EXCHANGERATE_HOST_ACCESS_KEY` is configured)
2. `frankfurter.dev` (free, no key)
3. `exchangerate.host/latest` legacy endpoint
4. static fallback rates embedded in code

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
- `GET /api/v1/crypto/token-prices`
- `POST /api/v1/crypto/token-prices`
- `GET /api/v1/crypto/accounts/:id/positions`
- `POST /api/v1/crypto/accounts/:id/positions`
- `DELETE /api/v1/crypto/accounts/:id/positions/:symbol`
- `GET /api/v1/crypto/portfolio`
- `GET /api/v1/tags`
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
- `POST /api/v1/auth/agent-tokens`
- `GET /api/v1/auth/agent-tokens`
- `DELETE /api/v1/auth/agent-tokens/:id`

Auth modes:

- Human web: email verification code + `nfos_session` cookie
- User agent: `Authorization: Bearer <agent_token>`
- Dev-only bypass (must be explicitly enabled): `AUTH_ALLOW_DEV_BYPASS=true` + `x-user-id`
