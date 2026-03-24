const { normalizeCurrency } = require("./fx");

const INCOME_HINTS = ["收到", "收款", "received", "income", "project payment", "salary"];

function parseAmountAndCurrency(text) {
  const normalizedText = String(text || "")
    .replace(/泰铢|บาท|baht/gi, " THB ")
    .replace(/人民币|人民幣|rmb/gi, " CNY ")
    .replace(/美金|美元/gi, " USD ");
  const amountThenCurrency = normalizedText.match(
    /([0-9]+(?:\.[0-9]+)?)\s*(USDT|USD|AUD|THB|RMB|CNY|SGD|EUR|GBP|JPY)/i
  );
  if (amountThenCurrency) {
    return {
      amount_original: Number(amountThenCurrency[1]),
      currency_original: normalizeCurrency(amountThenCurrency[2])
    };
  }
  const currencyThenAmount = normalizedText.match(
    /(USDT|USD|AUD|THB|RMB|CNY|SGD|EUR|GBP|JPY)\s*([0-9]+(?:\.[0-9]+)?)/i
  );
  if (currencyThenAmount) {
    return {
      amount_original: Number(currencyThenAmount[2]),
      currency_original: normalizeCurrency(currencyThenAmount[1])
    };
  }
  return { amount_original: 0, currency_original: "USD" };
}

function detectType(text) {
  const lower = text.toLowerCase();
  if (lower.includes("->") || lower.includes(" to ")) {
    return "transfer";
  }
  if (INCOME_HINTS.some((hint) => lower.includes(hint.toLowerCase()))) {
    return "income";
  }
  return "expense";
}

function detectCategory(text, categories) {
  const lower = text.toLowerCase();
  const dictionary = [
    { l1: "Living", l2: "Groceries", keywords: ["lunch", "dinner", "grocery", "午饭", "晚饭"] },
    { l1: "Living", l2: "Rent", keywords: ["rent", "房租"] },
    { l1: "Travel", l2: "Flights", keywords: ["flight", "air", "机票"] },
    { l1: "Travel", l2: "Hotels", keywords: ["hotel", "住宿"] },
    { l1: "Travel", l2: "Visa", keywords: ["visa", "签证"] },
    { l1: "Work", l2: "SaaS", keywords: ["subscription", "saas"] },
    { l1: "Lifestyle", l2: "Dining", keywords: ["coffee", "restaurant", "餐"] },
    { l1: "Lifestyle", l2: "Entertainment", keywords: ["travel", "trip", "旅游", "旅行", "vacation"] },
    { l1: "Study", l2: "Courses", keywords: ["course", "课程", "book", "书"] }
  ];
  for (const item of dictionary) {
    if (item.keywords.some((kw) => lower.includes(kw))) {
      if (categories[item.l1]?.l2?.some((entry) => entry.name === item.l2 && entry.active)) {
        return { category_l1: item.l1, category_l2: item.l2 };
      }
    }
  }
  const firstL1 = Object.entries(categories).find(([, cfg]) => cfg.active);
  if (!firstL1) return { category_l1: "", category_l2: "" };
  const [l1Name, cfg] = firstL1;
  const l2 = cfg.l2.find((entry) => entry.active);
  return { category_l1: l1Name, category_l2: l2 ? l2.name : "" };
}

function guessTransferAccounts(text, accounts) {
  const lower = text.toLowerCase();
  let from = null;
  let to = null;
  for (const account of accounts) {
    const label = account.name.toLowerCase();
    if (!from && lower.includes(`${label} ->`)) {
      from = account;
    }
    if (!to && (lower.includes(`-> ${label}`) || lower.includes(`to ${label}`))) {
      to = account;
    }
  }
  if (!from) {
    from = accounts.find((a) => a.type !== "restricted_cash") || null;
  }
  if (!to) {
    to = accounts.find((a) => a.type === "restricted_cash") || accounts[1] || accounts[0] || null;
  }
  return {
    account_from_id: from ? from.id : undefined,
    account_to_id: to ? to.id : undefined
  };
}

function parseFinancialText(text, { categories, accounts }) {
  const normalized = String(text || "").trim();
  const { amount_original, currency_original } = parseAmountAndCurrency(normalized);
  const type = detectType(normalized);
  const date = new Date().toISOString().slice(0, 10);
  const tags = [];

  if (normalized.toLowerCase().includes("deposit")) tags.push("deposit");
  if (normalized.toLowerCase().includes("reimbursable")) tags.push("reimbursable");

  if (type === "transfer") {
    const guessed = guessTransferAccounts(normalized, accounts);
    const reason = normalized.toLowerCase().includes("deposit")
      ? guessed.account_to_id &&
        accounts.find((a) => a.id === guessed.account_to_id)?.type === "restricted_cash"
        ? "deposit_lock"
        : "normal"
      : "normal";
    return {
      type,
      date,
      amount_original,
      currency_original,
      account_from_id: guessed.account_from_id,
      account_to_id: guessed.account_to_id,
      transfer_reason: reason,
      note: normalized,
      tags,
      confidence: 0.72
    };
  }

  if (type === "income") {
    const accountTo = accounts.find((a) => a.type !== "restricted_cash") || accounts[0];
    return {
      type,
      date,
      amount_original,
      currency_original,
      account_to_id: accountTo ? accountTo.id : undefined,
      note: normalized,
      tags,
      confidence: 0.76
    };
  }

  const cat = detectCategory(normalized, categories);
  const from = accounts.find((a) => a.type !== "restricted_cash") || accounts[0];
  return {
    type,
    date,
    amount_original,
    currency_original,
    category_l1: cat.category_l1,
    category_l2: cat.category_l2,
    account_from_id: from ? from.id : undefined,
    note: normalized,
    tags,
    confidence: 0.68
  };
}

module.exports = {
  parseFinancialText
};
