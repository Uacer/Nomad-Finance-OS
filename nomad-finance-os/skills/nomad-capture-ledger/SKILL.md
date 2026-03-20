---
name: nomad-capture-ledger
description: Record expenses, income, and transfers into Nomad Finance OS. Trigger when the user mentions spending, receiving money, or transferring funds. Uses a safe draft-and-confirm workflow — always show the parsed draft and wait for explicit user confirmation before writing.
allowed-tools: Bash(curl *)
---

# Nomad Capture Ledger

Record financial transactions via the Nomad Finance OS API.
Parse first, show draft, confirm only after explicit user approval.

## Environment

Required:
- `NOMAD_API_BASE_URL` — server URL, e.g. `https://your-server.com`
- `NOMAD_API_TOKEN` — Bearer token from Settings → Agent Access

## Workflow

1. Parse the user's message into a draft.
2. Show the draft (type, amount, currency, category, account, date).
3. Ask: "Confirm to record?" — wait for explicit yes/confirm/确认.
4. On confirm: POST confirm-extraction.
5. On cancel or no: stop. Do not write.

## Step 1 — Parse text

```sh
curl -s -X POST "$NOMAD_API_BASE_URL/api/v1/transactions/parse-text" \
  -H "Authorization: Bearer $NOMAD_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text": "<user message>"}'
```

Response fields to show the user:
- `extraction_id` — save this for confirm
- `draft.type` — expense / income / transfer
- `draft.amount_original` + `draft.currency_original`
- `draft.category_l1` / `draft.category_l2`
- `draft.account_from_id` / `draft.account_to_id`
- `draft.date`
- `draft.confidence`
- `summary_zh` / `summary_en` — bilingual summary

## Step 1 (alt) — Parse OCR / image text

```sh
curl -s -X POST "$NOMAD_API_BASE_URL/api/v1/transactions/parse-image" \
  -H "Authorization: Bearer $NOMAD_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ocr_text": "<extracted text from image>"}'
```

## Step 2 — Confirm

```sh
curl -s -X POST "$NOMAD_API_BASE_URL/api/v1/transactions/confirm-extraction" \
  -H "Authorization: Bearer $NOMAD_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"extraction_id": <id>}'
```

With optional field overrides:
```sh
curl -s -X POST "$NOMAD_API_BASE_URL/api/v1/transactions/confirm-extraction" \
  -H "Authorization: Bearer $NOMAD_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"extraction_id": <id>, "overrides": {"category_l1": "Food", "account_from_id": 1}}'
```

## Cancel

No API call needed. Just inform the user that no transaction was written.

## Hard Rules

- If `draft.confidence >= 0.85`, may auto-confirm without asking (skip the confirmation prompt).
- If confidence is lower, show draft and ask for confirmation before writing.
- Never write on cancel.
- Always show the full draft before writing (even when auto-confirming, display the result).
- If confirm returns a validation error, show the error and ask for corrected values.
