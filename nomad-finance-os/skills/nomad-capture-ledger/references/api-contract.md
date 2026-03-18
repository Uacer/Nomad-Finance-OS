# API Contract

Base URL: `${NOMAD_API_BASE_URL}`

Headers:

- `content-type: application/json`
- `authorization: Bearer ${NOMAD_API_TOKEN}`

Dev-only fallback (when backend allows bypass):

- `x-user-id: ${NOMAD_USER_ID:-1}`

Optional parse header behavior:

- If `NOMAD_PROVIDER_ID` is set, include `provider_id` in parse body.

## 1) Parse text

`POST /api/v1/transactions/parse-text`

Body:

```json
{
  "text": "午饭220泰铢",
  "provider_id": 3
}
```

`provider_id` is optional.

Success `201`:

```json
{
  "extraction_id": 21,
  "draft": {
    "type": "expense",
    "date": "2026-03-13",
    "amount_original": 220,
    "currency_original": "THB",
    "category_l1": "Lifestyle",
    "category_l2": "Dining",
    "account_from_id": 8,
    "note": "午饭220泰铢",
    "tags": [],
    "confidence": 0.86,
    "fx_rate": 0.028,
    "amount_base": 6.16
  },
  "fallback_used": false,
  "error_message": ""
}
```

## 2) Parse OCR text

`POST /api/v1/transactions/parse-image`

Body:

```json
{
  "ocr_text": "7-Eleven 120 THB",
  "provider_id": 3
}
```

Note: do not send `image_base64` in this MVP skill.

## 3) Confirm extraction

`POST /api/v1/transactions/confirm-extraction`

Body:

```json
{
  "extraction_id": 21,
  "overrides": {
    "account_from_id": 8,
    "category_l1": "Lifestyle",
    "category_l2": "Dining"
  }
}
```

`overrides` is optional.

Success `201`: transaction object.

## 4) Lookup context for repair

`GET /api/v1/categories`

`GET /api/v1/accounts`

Use these two endpoints when category/account validation fails.

## Common Errors

- `400 No active AI provider configured. Create and set a default provider first.`
  - Action: stop parse/confirm and request provider setup.
- `400 Invalid extraction payload.` or specific validation text
  - Action: fetch categories/accounts, request corrected overrides.
- `502 AI parsing failed.` or `502 AI image parsing failed.`
  - Action: retry parse once, then return manual-edit guidance.
