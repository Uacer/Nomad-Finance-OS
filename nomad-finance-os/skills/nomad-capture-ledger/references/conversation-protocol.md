# Conversation Protocol (OpenClaw)

## Goal

Return draft first, require explicit confirmation, then write once.

## Intent Mapping

- User sends normal text spending/income/transfer message -> run `capture_text`.
- User sends OCR-extracted receipt text -> run `capture_ocr`.
- User says confirm (e.g. "确认", "yes confirm", "入账") -> run `confirm_capture`.
- User says cancel (e.g. "取消", "算了", "abort") -> run `cancel_capture`.

## Confirmation Gate

Only treat the request as confirmed when the user clearly indicates confirmation.

Do not infer confirmation from confidence value or tone.

## Output Format

For draft stage, always provide:

1. Structured JSON payload (English keys).
2. Chinese readable summary.
3. English readable summary.
4. A direct confirmation prompt.

Example confirmation prompt:

- ZH: `请确认是否入账（回复：确认 / 取消）`
- EN: `Please confirm posting (reply: confirm / cancel).`

## Repair Prompts

When provider is missing:

- ZH: `当前未配置可用 AI Provider，请先在系统中创建并设为默认。`
- EN: `No active AI provider is configured. Please create and set a default provider first.`

When category/account is invalid:

- Fetch categories/accounts and provide concise candidate options.
- Ask user for corrected fields, then rerun confirm with overrides.

## Cancel Behavior

On cancel, return a cancellation message and do not call any write endpoint.

Example:

```json
{
  "ok": true,
  "action": "cancel",
  "extraction_id": 21,
  "written": false,
  "message_zh": "已取消，本次不入账。",
  "message_en": "Cancelled. No transaction was written."
}
```
