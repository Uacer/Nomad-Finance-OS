const { decryptText } = require("./security");
const { parseFinancialText } = require("./parser");

function mapCategoriesForPrompt(categoriesMap) {
  return Object.entries(categoriesMap)
    .filter(([, cfg]) => cfg.active)
    .map(([l1, cfg]) => ({
      l1,
      l2: cfg.l2.filter((x) => x.active).map((x) => x.name)
    }));
}

function extractJsonFromText(text) {
  const content = String(text || "").trim();
  if (!content) return null;
  try {
    return JSON.parse(content);
  } catch {
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      try {
        return JSON.parse(content.slice(start, end + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}

async function parseWithProvider(provider, { text, imageBase64 }, { categories, accounts }) {
  const apiKey = decryptText(provider.encrypted_api_key);
  const baseUrl = String(provider.base_url || "").replace(/\/$/, "");
  const model = provider.model || "gpt-4.1-mini";
  const schemaHint = {
    type: "expense|income|transfer",
    date: "YYYY-MM-DD",
    amount_original: 123.45,
    currency_original: "USD",
    category_l1: "Living",
    category_l2: "Groceries",
    account_from_id: 1,
    account_to_id: 2,
    transfer_reason: "normal|deposit_lock|deposit_release",
    note: "short note",
    tags: ["tag-a", "tag-b"],
    confidence: 0.0
  };
  const prompt = [
    "You are a finance parser. Return JSON only, no markdown.",
    "Normalize currency aliases (e.g. baht/泰铢/บาท => THB, 人民币/元 => CNY).",
    "For daily Chinese phrasing, infer intent from verbs like 花了/买了/收到/转账.",
    "If user text mentions travel/tourism spend (旅游/旅行/trip), prefer Lifestyle/Entertainment unless explicit transport or hotel terms exist.",
    `Allowed categories: ${JSON.stringify(mapCategoriesForPrompt(categories))}`,
    `Known accounts: ${JSON.stringify(accounts.map((a) => ({ id: a.id, name: a.name, type: a.type })))}`,
    `Output schema example: ${JSON.stringify(schemaHint)}`,
    "Few-shot examples:",
    'Input: "旅游花了10000泰铢" -> {"type":"expense","amount_original":10000,"currency_original":"THB"}',
    'Input: "收到项目款 800 USDT" -> {"type":"income","amount_original":800,"currency_original":"USDT"}',
    'Input: "Wise -> Thai Bank 500 USD" -> {"type":"transfer","amount_original":500,"currency_original":"USD"}',
    `Text: ${text || "(empty)"}`
  ].join("\n");

  const userContent =
    imageBase64 && !text
      ? [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: imageBase64 } }
        ]
      : prompt;

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      messages: [
        { role: "system", content: "Return strict JSON object only." },
        { role: "user", content: userContent }
      ]
    })
  });

  if (!response.ok) {
    let detail = `Provider call failed (${response.status}).`;
    try {
      const payload = await response.json();
      const message =
        payload?.error?.message ||
        payload?.message ||
        (typeof payload?.error === "string" ? payload.error : "");
      if (message) {
        detail = `Provider call failed (${response.status}): ${String(message)}`;
      }
    } catch {
      try {
        const text = await response.text();
        if (text && String(text).trim()) {
          detail = `Provider call failed (${response.status}): ${String(text).slice(0, 240)}`;
        }
      } catch {
        // ignore body parse errors; keep status-only message
      }
    }
    throw new Error(detail);
  }
  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content || "";
  const parsed = extractJsonFromText(content);
  if (!parsed) {
    throw new Error("Provider response is not valid JSON.");
  }
  return parsed;
}

async function buildExtractionDraft({
  provider,
  text,
  imageBase64,
  categories,
  accounts,
  mode = "hybrid"
}) {
  const strictProvider = mode === "provider_only";

  if ((!text || !String(text).trim()) && !imageBase64) {
    if (strictProvider) {
      throw new Error("No text or image payload provided for AI parsing.");
    }
    return {
      draft: {
        type: "expense",
        date: new Date().toISOString().slice(0, 10),
        amount_original: 0,
        currency_original: "USD",
        note: "",
        confidence: 0
      },
      fallback_used: true,
      error_message: "No text available for parsing."
    };
  }

  if (!provider) {
    if (strictProvider) {
      throw new Error("No active AI provider configured.");
    }
    if (!text || !String(text).trim()) {
      return {
        draft: {
          type: "expense",
          date: new Date().toISOString().slice(0, 10),
          amount_original: 0,
          currency_original: "USD",
          note: "",
          confidence: 0
        },
        fallback_used: true,
        error_message: "No provider configured for image-only parsing."
      };
    }
    return {
      draft: parseFinancialText(text, { categories, accounts }),
      fallback_used: true,
      error_message: "No active provider configured; used heuristic parser."
    };
  }

  try {
    const draft = await parseWithProvider(
      provider,
      { text, imageBase64 },
      { categories, accounts }
    );
    return {
      draft,
      fallback_used: false,
      error_message: ""
    };
  } catch (error) {
    if (strictProvider) {
      throw new Error(String(error.message || "Provider parsing failed."));
    }
    return {
      draft: parseFinancialText(text, { categories, accounts }),
      fallback_used: true,
      error_message: String(error.message || "Provider failed; fallback parser used.")
    };
  }
}

module.exports = {
  buildExtractionDraft
};
