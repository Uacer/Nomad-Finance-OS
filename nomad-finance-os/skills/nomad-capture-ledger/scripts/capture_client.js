#!/usr/bin/env node

const DEFAULT_TIMEOUT_MS = 15000;

class ApiError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "ApiError";
    this.status = options.status || 0;
    this.payload = options.payload;
    this.url = options.url || "";
    this.method = options.method || "GET";
  }
}

async function main() {
  const cli = parseCli(process.argv.slice(2));
  const command = cli.command;
  const options = cli.options;

  if (!command || ["help", "--help", "-h"].includes(command)) {
    printHelp();
    return;
  }

  if (command === "cancel") {
    const extractionId = toPositiveInt(options["extraction-id"]);
    if (!extractionId) {
      throw new Error("cancel requires --extraction-id <number>");
    }
    printJson({
      ok: true,
      action: "cancel",
      extraction_id: extractionId,
      written: false,
      message_zh: "已取消，本次不入账。",
      message_en: "Cancelled. No transaction was written."
    });
    return;
  }

  const baseUrl = String(process.env.NOMAD_API_BASE_URL || "").trim().replace(/\/+$/, "");
  if (!baseUrl) {
    throw new Error("NOMAD_API_BASE_URL is required.");
  }

  const userId =
    toPositiveInt(options["user-id"]) || toPositiveInt(process.env.NOMAD_USER_ID) || 1;
  const apiToken = String(options["api-token"] || process.env.NOMAD_API_TOKEN || "").trim();
  const allowDevBypass = toBoolean(
    options["allow-dev-bypass"] !== undefined
      ? options["allow-dev-bypass"]
      : process.env.NOMAD_ALLOW_DEV_BYPASS
  );
  const providerId =
    toPositiveInt(options["provider-id"]) || toPositiveInt(process.env.NOMAD_PROVIDER_ID);
  const timeoutMs =
    toPositiveInt(options["timeout-ms"]) || toPositiveInt(process.env.NOMAD_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;
  if (!apiToken && !allowDevBypass) {
    throw new Error("NOMAD_API_TOKEN is required unless --allow-dev-bypass true is set.");
  }
  const auth = { apiToken, allowDevBypass, userId };

  if (command === "lookup-context") {
    const context = await fetchRepairContext({ baseUrl, timeoutMs, auth });
    printJson({ ok: true, action: "lookup-context", ...context });
    return;
  }

  if (command === "capture-text") {
    const text = String(options.message || "").trim();
    if (!text) {
      throw new Error("capture-text requires --message \"...\"");
    }
    const body = { text };
    if (providerId) body.provider_id = providerId;
    const result = await parseWithRetry({
      baseUrl,
      timeoutMs,
      auth,
      endpoint: "/api/v1/transactions/parse-text",
      body,
      retriesOn502: 1
    });
    printJson(buildDraftOutput(result));
    return;
  }

  if (command === "capture-ocr") {
    const ocrText = String(options["ocr-text"] || "").trim();
    if (!ocrText) {
      throw new Error("capture-ocr requires --ocr-text \"...\"");
    }
    const body = { ocr_text: ocrText };
    if (providerId) body.provider_id = providerId;
    const result = await parseWithRetry({
      baseUrl,
      timeoutMs,
      auth,
      endpoint: "/api/v1/transactions/parse-image",
      body,
      retriesOn502: 1
    });
    printJson(buildDraftOutput(result));
    return;
  }

  if (command === "confirm") {
    const extractionId = toPositiveInt(options["extraction-id"]);
    if (!extractionId) {
      throw new Error("confirm requires --extraction-id <number>");
    }
    let overrides;
    if (options["overrides-json"]) {
      try {
        overrides = JSON.parse(String(options["overrides-json"]));
      } catch {
        throw new Error("--overrides-json must be valid JSON.");
      }
    }
    try {
      const payload = {
        extraction_id: extractionId,
        ...(overrides ? { overrides } : {})
      };
      const tx = await callApi({
        baseUrl,
        timeoutMs,
        auth,
        method: "POST",
        endpoint: "/api/v1/transactions/confirm-extraction",
        body: payload
      });
      printJson({
        ok: true,
        action: "confirm",
        written: true,
        transaction: tx,
        message_zh: "已确认并入账。",
        message_en: "Confirmed and posted to ledger."
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 400) {
        const message = getErrorMessage(error);
        const context = await fetchRepairContext({ baseUrl, timeoutMs, auth }).catch(() => null);
        printJson({
          ok: false,
          action: "confirm",
          written: false,
          error_code: "INVALID_CONFIRM_PAYLOAD",
          error_message: message,
          guidance_zh: "确认失败。请根据候选账户/分类修正 overrides 后重试。",
          guidance_en: "Confirm failed. Fix overrides using suggested accounts/categories and retry.",
          candidates: context || undefined
        });
        process.exitCode = 1;
        return;
      }
      throw error;
    }
    return;
  }

  throw new Error(`Unsupported command: ${command}`);
}

function buildDraftOutput(result) {
  const extractionId = result.extraction_id || null;
  const draft = result.draft || {};
  const account = draft.account_from_id || draft.account_to_id || null;
  const confidence =
    draft.confidence === undefined || draft.confidence === null ? null : Number(draft.confidence);
  return {
    ok: true,
    action: "draft",
    extraction_id: extractionId,
    required_view: {
      extraction_id: extractionId,
      type: draft.type || null,
      amount_original: draft.amount_original ?? null,
      currency_original: draft.currency_original || null,
      category_l1: draft.category_l1 || null,
      category_l2: draft.category_l2 || null,
      account,
      date: draft.date || null,
      confidence
    },
    draft,
    summary_zh: `草稿#${display(extractionId)}：${display(draft.type)} ${display(draft.amount_original)} ${display(
      draft.currency_original
    )}，分类 ${display(draft.category_l1)}/${display(draft.category_l2)}，账户 ${display(account)}，日期 ${display(
      draft.date
    )}，置信度 ${display(confidence)}。`,
    summary_en: `Draft #${display(extractionId)}: ${display(draft.type)} ${display(
      draft.amount_original
    )} ${display(draft.currency_original)}, category ${display(draft.category_l1)}/${display(
      draft.category_l2
    )}, account ${display(account)}, date ${display(draft.date)}, confidence ${display(confidence)}.`,
    next_step: {
      zh: "请确认是否入账（回复：确认 / 取消）",
      en: "Please confirm posting (reply: confirm / cancel)."
    },
    provider_fallback_used: Boolean(result.fallback_used),
    provider_error_message: result.error_message || ""
  };
}

async function parseWithRetry(input) {
  let lastError;
  const maxAttempts = 1 + Number(input.retriesOn502 || 0);
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await callApi({
        baseUrl: input.baseUrl,
        timeoutMs: input.timeoutMs,
        auth: input.auth,
        method: "POST",
        endpoint: input.endpoint,
        body: input.body
      });
      return response;
    } catch (error) {
      lastError = error;
      if (!(error instanceof ApiError)) {
        throw error;
      }
      const message = getErrorMessage(error);
      if (error.status === 400 && message.includes("No active AI provider configured")) {
        printJson({
          ok: false,
          action: "draft",
          error_code: "PROVIDER_MISSING",
          error_message: message,
          guidance_zh: "当前未配置可用 AI Provider，请先在系统中创建并设为默认。",
          guidance_en: "No active AI provider is configured. Please create and set a default provider first."
        });
        process.exitCode = 1;
        process.exit();
      }
      if (error.status === 502 && attempt < maxAttempts) {
        continue;
      }
    }
  }

  if (lastError instanceof ApiError && lastError.status === 502) {
    printJson({
      ok: false,
      action: "draft",
      error_code: "AI_PARSE_UNAVAILABLE",
      error_message: getErrorMessage(lastError),
      retries: Number(input.retriesOn502 || 0),
      guidance_zh: "AI 解析失败（已重试一次）。请手动修正关键字段后再确认。",
      guidance_en: "AI parsing failed after one retry. Manually adjust key fields before confirm."
    });
    process.exitCode = 1;
    process.exit();
  }

  throw lastError;
}

async function fetchRepairContext(input) {
  const [categories, accounts] = await Promise.all([
    callApi({
      baseUrl: input.baseUrl,
      timeoutMs: input.timeoutMs,
      auth: input.auth,
      method: "GET",
      endpoint: "/api/v1/categories"
    }),
    callApi({
      baseUrl: input.baseUrl,
      timeoutMs: input.timeoutMs,
      auth: input.auth,
      method: "GET",
      endpoint: "/api/v1/accounts"
    })
  ]);

  const activeCategories = [];
  for (const [l1Name, config] of Object.entries(categories || {})) {
    if (!config || !config.active) continue;
    const l2 = (config.l2 || []).filter((row) => row.active).map((row) => row.name);
    activeCategories.push({ category_l1: l1Name, category_l2_list: l2 });
  }

  const accountList = (accounts || []).map((row) => ({
    id: row.id,
    name: row.name,
    type: row.type,
    currency: row.currency,
    balance: row.balance
  }));

  return {
    categories: activeCategories,
    accounts: accountList
  };
}

async function callApi(input) {
  const endpoint = input.endpoint.startsWith("/") ? input.endpoint : `/${input.endpoint}`;
  const url = `${input.baseUrl}${endpoint}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(input.timeoutMs || DEFAULT_TIMEOUT_MS));
  try {
    const headers = {
      "content-type": "application/json"
    };
    if (input.auth?.apiToken) {
      headers.authorization = `Bearer ${input.auth.apiToken}`;
    } else if (input.auth?.allowDevBypass) {
      headers["x-user-id"] = String(input.auth?.userId || 1);
    }
    const res = await fetch(url, {
      method: input.method,
      headers,
      body: input.body ? JSON.stringify(input.body) : undefined,
      signal: controller.signal
    });
    const payload = await safeJson(res);
    if (!res.ok) {
      throw new ApiError(getErrorMessage({ payload, status: res.status }), {
        status: res.status,
        payload,
        url,
        method: input.method
      });
    }
    return payload;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new ApiError(`Request timed out after ${input.timeoutMs}ms`, {
        status: 0,
        payload: null,
        url,
        method: input.method
      });
    }
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(String(error.message || "Request failed"), {
      status: 0,
      payload: null,
      url,
      method: input.method
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function safeJson(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function getErrorMessage(source) {
  const payload = source && source.payload ? source.payload : source;
  if (payload && typeof payload.error === "string") return payload.error;
  if (payload && payload.error) {
    try {
      return JSON.stringify(payload.error);
    } catch {
      return String(payload.error);
    }
  }
  if (payload && typeof payload.message === "string") return payload.message;
  if (source && typeof source.message === "string") return source.message;
  if (source && source.status) return `HTTP ${source.status}`;
  return "Unknown error";
}

function parseCli(args) {
  const command = args[0] || "";
  const options = {};
  let index = 1;
  while (index < args.length) {
    const token = args[index];
    if (!token.startsWith("--")) {
      index += 1;
      continue;
    }
    const key = token.slice(2);
    const next = args[index + 1];
    if (!next || next.startsWith("--")) {
      options[key] = "true";
      index += 1;
      continue;
    }
    options[key] = next;
    index += 2;
  }
  return { command, options };
}

function toPositiveInt(value) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function toBoolean(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(normalized);
}

function display(value) {
  return value === null || value === undefined || value === "" ? "-" : String(value);
}

function printJson(payload) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

function printHelp() {
  const help = `nomad-capture-ledger client

Commands:
  capture-text --message "..." [--provider-id 3] [--api-token xxx] [--allow-dev-bypass true] [--user-id 1] [--timeout-ms 15000]
  capture-ocr --ocr-text "..." [--provider-id 3] [--api-token xxx] [--allow-dev-bypass true] [--user-id 1] [--timeout-ms 15000]
  confirm --extraction-id 123 [--overrides-json '{"account_from_id":8}'] [--api-token xxx] [--allow-dev-bypass true] [--user-id 1]
  cancel --extraction-id 123
  lookup-context [--api-token xxx] [--allow-dev-bypass true] [--user-id 1]

Environment:
  NOMAD_API_BASE_URL (required except cancel)
  NOMAD_API_TOKEN (recommended)
  NOMAD_ALLOW_DEV_BYPASS (default false; when true uses x-user-id fallback)
  NOMAD_USER_ID (dev bypass only, default 1)
  NOMAD_PROVIDER_ID (optional)
  NOMAD_TIMEOUT_MS (default 15000)
`;
  process.stdout.write(help);
}

main().catch((error) => {
  const payload = {
    ok: false,
    action: "error",
    error_message: String(error.message || error)
  };
  printJson(payload);
  process.exitCode = 1;
});
