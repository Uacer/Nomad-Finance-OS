---
name: nomad-capture-ledger
description: Capture bookkeeping input from OpenClaw into Nomad Finance OS using a safe two-step draft-and-confirm workflow. Use when a user sends expense/income/transfer text or OCR text and wants structured draft output, bilingual (ZH/EN) summaries, confirmation before write, and actionable recovery hints for provider/category/account errors.
---

# Nomad Capture Ledger

## Overview

Use this skill to convert chat messages into ledger-ready drafts, then confirm writes only after explicit user approval.

Keep writes safe: parse first, show draft, confirm second.

## Required Runtime Config

Set these environment variables before running scripts:

- `NOMAD_API_BASE_URL` (required), for example `http://localhost:5001`
- `NOMAD_USER_ID` (optional, default `1`)
- `NOMAD_PROVIDER_ID` (optional)
- `NOMAD_TIMEOUT_MS` (optional, default `15000`)

## Workflow

1. Parse input into extraction draft.
2. Return draft JSON plus bilingual summary.
3. Ask for explicit confirmation.
4. Confirm extraction only after confirmation.
5. On cancel, stop the flow and do not write transactions.

## Commands

Use the client script in `scripts/capture_client.js`.

- `capture_text(message)`
  - Run: `node scripts/capture_client.js capture-text --message "..."`
- `capture_ocr(ocr_text)`
  - Run: `node scripts/capture_client.js capture-ocr --ocr-text "..."`
- `confirm_capture(extraction_id, overrides?)`
  - Run: `node scripts/capture_client.js confirm --extraction-id 123 [--overrides-json '{...}']`
- `cancel_capture(extraction_id)`
  - Run: `node scripts/capture_client.js cancel --extraction-id 123`

Optional helper:

- `node scripts/capture_client.js lookup-context`
  - Return active categories/accounts to repair invalid draft overrides.

## Output Contract

For parse commands, return these fields whenever present:

- `extraction_id`
- `draft.type`
- `draft.amount_original`
- `draft.currency_original`
- `draft.category_l1`
- `draft.category_l2`
- `draft.account_from_id` or `draft.account_to_id`
- `draft.date`
- `draft.confidence`
- `summary_zh`
- `summary_en`

Keep structured keys in English. Keep readable summary bilingual.

## Hard Safety Rules

- Never call confirm APIs without explicit user confirmation.
- Never auto-confirm by confidence score.
- Never write on cancel.
- Keep retry policy strict: retry parse once on HTTP `502`, then return repair guidance.

## Failure Handling

- If `400` contains `No active AI provider configured`, stop and instruct provider setup.
- If category/account validation fails, return `lookup-context` suggestions and request corrected overrides.
- If parse returns `502` twice, return manual-edit guidance with suggested override fields.

## References

- Use `references/api-contract.md` for payload/response expectations.
- Use `references/conversation-protocol.md` for OpenClaw dialogue behavior.
