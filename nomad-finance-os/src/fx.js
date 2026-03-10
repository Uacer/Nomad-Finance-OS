const FALLBACK_USD_RATES = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  THB: 35.5,
  RMB: 7.2,
  CNY: 7.2,
  SGD: 1.34,
  JPY: 148,
  USDT: 1
};

function normalizeCurrency(currency) {
  return String(currency || "USD").trim().toUpperCase();
}

function fallbackFxRate(from, to) {
  const f = normalizeCurrency(from);
  const t = normalizeCurrency(to);
  if (f === t) return 1;
  const fToUsd = 1 / (FALLBACK_USD_RATES[f] || 1);
  const usdToT = FALLBACK_USD_RATES[t] || 1;
  return Number((fToUsd * usdToT).toFixed(8));
}

async function fetchFxRate(from, to) {
  const f = normalizeCurrency(from);
  const t = normalizeCurrency(to);
  if (f === t) {
    return { rate: 1, source: "identity" };
  }

  try {
    const url = `https://api.exchangerate.host/latest?base=${encodeURIComponent(
      f
    )}&symbols=${encodeURIComponent(t)}`;
    const response = await fetch(url, { method: "GET" });
    if (!response.ok) {
      throw new Error(`FX provider failed: ${response.status}`);
    }
    const payload = await response.json();
    const rate = Number(payload?.rates?.[t]);
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new Error("Invalid FX rate from provider.");
    }
    return { rate: Number(rate.toFixed(8)), source: "exchangerate.host" };
  } catch {
    return { rate: fallbackFxRate(f, t), source: "fallback_static" };
  }
}

module.exports = {
  normalizeCurrency,
  fetchFxRate,
  fallbackFxRate
};
