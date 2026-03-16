const FALLBACK_USD_RATES = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  THB: 35.5,
  RMB: 7.2,
  CNY: 7.2,
  SGD: 1.34,
  JPY: 148,
  KRW: 1365,
  USDT: 1
};

const EXCHANGERATE_HOST_KEY = String(
  process.env.EXCHANGERATE_HOST_ACCESS_KEY || process.env.EXCHANGERATE_HOST_API_KEY || ""
).trim();
const FX_ALLOW_STATIC_FALLBACK = String(process.env.FX_ALLOW_STATIC_FALLBACK || "false")
  .trim()
  .toLowerCase() !== "false";
const FX_RECENT_CACHE_MAX_AGE_MS = Math.max(
  60 * 1000,
  Number.parseInt(String(process.env.FX_RECENT_CACHE_MAX_AGE_MS || `${6 * 60 * 60 * 1000}`), 10) ||
    6 * 60 * 60 * 1000
);
const FX_RECENT_CACHE = new Map();

function normalizeCurrency(currency) {
  const raw = String(currency || "USD").trim();
  const upper = raw.toUpperCase();
  const aliasMap = {
    BAHT: "THB",
    THAIBAHT: "THB",
    "泰铢": "THB",
    "บาท": "THB",
    CNH: "CNY",
    RMB: "CNY",
    "人民币": "CNY",
    "人民幣": "CNY",
    "元": "CNY",
    "美元": "USD",
    "美金": "USD",
    "欧元": "EUR",
    "英镑": "GBP",
    "日元": "JPY",
    "韩元": "KRW",
    "韓元": "KRW",
    WON: "KRW",
    "원": "KRW",
    "新币": "SGD",
    "新元": "SGD"
  };
  return aliasMap[upper] || aliasMap[raw] || upper;
}

function fallbackFxRate(from, to) {
  const f = normalizeCurrency(from);
  const t = normalizeCurrency(to);
  if (f === t) return 1;
  const fToUsd = 1 / (FALLBACK_USD_RATES[f] || 1);
  const usdToT = FALLBACK_USD_RATES[t] || 1;
  return Number((fToUsd * usdToT).toFixed(8));
}

function toPairKey(from, to) {
  return `${from}->${to}`;
}

function rememberRecentQuote(from, to, rate, source = "provider") {
  const numericRate = Number(rate);
  if (!Number.isFinite(numericRate) || numericRate <= 0) return;
  const normalizedFrom = normalizeCurrency(from);
  const normalizedTo = normalizeCurrency(to);
  const asOfMs = Date.now();
  FX_RECENT_CACHE.set(toPairKey(normalizedFrom, normalizedTo), {
    rate: Number(numericRate.toFixed(8)),
    source,
    asOfMs
  });
  const inverse = 1 / numericRate;
  if (Number.isFinite(inverse) && inverse > 0) {
    FX_RECENT_CACHE.set(toPairKey(normalizedTo, normalizedFrom), {
      rate: Number(inverse.toFixed(8)),
      source: `${source}_inverse`,
      asOfMs
    });
  }
}

function getRecentQuote(from, to, maxAgeMs = FX_RECENT_CACHE_MAX_AGE_MS) {
  const normalizedFrom = normalizeCurrency(from);
  const normalizedTo = normalizeCurrency(to);
  const cached = FX_RECENT_CACHE.get(toPairKey(normalizedFrom, normalizedTo));
  if (!cached) return null;
  const ageMs = Math.max(0, Date.now() - Number(cached.asOfMs || 0));
  if (!Number.isFinite(ageMs) || ageMs > maxAgeMs) return null;
  return { ...cached, ageMs };
}

function peekRecentRate(from, to, maxAgeMs = FX_RECENT_CACHE_MAX_AGE_MS) {
  const f = normalizeCurrency(from);
  const t = normalizeCurrency(to);
  if (f === t) return 1;
  const recent = getRecentQuote(f, t, maxAgeMs);
  if (!recent) return null;
  const rate = Number(recent.rate);
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

async function fetchFxRate(from, to) {
  const f = normalizeCurrency(from);
  const t = normalizeCurrency(to);
  if (f === t) {
    return { rate: 1, source: "identity" };
  }

  const providerErrors = [];

  if (EXCHANGERATE_HOST_KEY) {
    try {
      const quote = await fetchFromExchangeRateHostLive(f, t, EXCHANGERATE_HOST_KEY);
      rememberRecentQuote(f, t, quote.rate, quote.source);
      return quote;
    } catch (error) {
      providerErrors.push(String(error?.message || "exchangerate.host_live failed"));
      // continue to next provider
    }
  }

  try {
    const quote = await fetchFromFrankfurter(f, t);
    rememberRecentQuote(f, t, quote.rate, quote.source);
    return quote;
  } catch (error) {
    providerErrors.push(String(error?.message || "frankfurter failed"));
    // continue to next provider
  }

  try {
    const quote = await fetchFromExchangeRateHostLegacy(f, t);
    rememberRecentQuote(f, t, quote.rate, quote.source);
    return quote;
  } catch (error) {
    providerErrors.push(String(error?.message || "exchangerate.host_latest failed"));
  }

  const recent = getRecentQuote(f, t);
  if (recent) {
    return {
      rate: Number(recent.rate),
      source: "recent_cache",
      cached_source: recent.source,
      as_of: new Date(recent.asOfMs).toISOString(),
      age_ms: recent.ageMs,
      is_stale: true
    };
  }

  if (!FX_ALLOW_STATIC_FALLBACK) {
    const err = new Error("FX providers unavailable and no recent cached quote.");
    err.code = "FX_QUOTE_UNAVAILABLE";
    err.provider_errors = providerErrors.slice(0, 3);
    throw err;
  }

  return {
    rate: fallbackFxRate(f, t),
    source: "fallback_static",
    is_stale: true,
    provider_errors: providerErrors.slice(0, 3)
  };
}

async function fetchFromExchangeRateHostLive(from, to, accessKey) {
  const url = `https://api.exchangerate.host/live?access_key=${encodeURIComponent(
    accessKey
  )}&source=${encodeURIComponent(from)}&currencies=${encodeURIComponent(to)}`;
  const response = await fetch(url, { method: "GET" });
  if (!response.ok) {
    throw new Error(`FX provider failed: ${response.status}`);
  }
  const payload = await response.json();
  if (!payload?.success) {
    throw new Error(payload?.error?.info || "Invalid FX payload from exchangerate.host/live.");
  }
  const quoteKey = `${from}${to}`;
  const rate = Number(payload?.quotes?.[quoteKey]);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error("Invalid FX rate from exchangerate.host/live.");
  }
  return { rate: Number(rate.toFixed(8)), source: "exchangerate.host_live" };
}

async function fetchFromFrankfurter(from, to) {
  const url = `https://api.frankfurter.dev/v1/latest?base=${encodeURIComponent(
    from
  )}&symbols=${encodeURIComponent(to)}`;
  const response = await fetch(url, { method: "GET" });
  if (!response.ok) {
    throw new Error(`FX provider failed: ${response.status}`);
  }
  const payload = await response.json();
  const rate = Number(payload?.rates?.[to]);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error("Invalid FX rate from frankfurter.");
  }
  return { rate: Number(rate.toFixed(8)), source: "frankfurter" };
}

async function fetchFromExchangeRateHostLegacy(from, to) {
  const url = `https://api.exchangerate.host/latest?base=${encodeURIComponent(
    from
  )}&symbols=${encodeURIComponent(to)}`;
  const response = await fetch(url, { method: "GET" });
  if (!response.ok) {
    throw new Error(`FX provider failed: ${response.status}`);
  }
  const payload = await response.json();
  if (payload?.success === false) {
    throw new Error(payload?.error?.info || "Invalid FX payload from exchangerate.host/latest.");
  }
  const rate = Number(payload?.rates?.[to]);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error("Invalid FX rate from exchangerate.host/latest.");
  }
  return { rate: Number(rate.toFixed(8)), source: "exchangerate.host_latest" };
}

async function refreshRecentFxCache(currencies) {
  const list = [...new Set((currencies || []).map((x) => normalizeCurrency(x)).filter(Boolean))];
  const safeList = list.length ? list : ["USD", "CNY", "EUR", "THB", "JPY", "KRW"];
  const pairs = [];
  for (const from of safeList) {
    for (const to of safeList) {
      if (from === to) continue;
      pairs.push([from, to]);
    }
  }
  let success = 0;
  let failed = 0;
  const errors = [];
  for (const [from, to] of pairs) {
    try {
      await fetchFxRate(from, to);
      success += 1;
    } catch (error) {
      failed += 1;
      if (errors.length < 5) {
        errors.push(`${from}->${to}: ${String(error?.message || "unknown error")}`);
      }
    }
  }
  return {
    total: pairs.length,
    success,
    failed,
    errors
  };
}

module.exports = {
  normalizeCurrency,
  fetchFxRate,
  fallbackFxRate,
  peekRecentRate,
  refreshRecentFxCache,
  __resetRecentFxCacheForTests() {
    FX_RECENT_CACHE.clear();
  }
};
