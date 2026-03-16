const test = require("node:test");
const assert = require("node:assert/strict");
const { fetchFxRate, __resetRecentFxCacheForTests } = require("../src/fx");

test("falls back to recent cached quote when all providers fail", async () => {
  __resetRecentFxCacheForTests();
  const originalFetch = global.fetch;
  let shouldFail = false;
  global.fetch = async () => {
    if (shouldFail) {
      throw new Error("network down");
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ rates: { CNY: 6.88 } })
    };
  };
  try {
    const first = await fetchFxRate("USD", "CNY");
    assert.equal(first.source, "frankfurter");
    assert.equal(first.rate, 6.88);

    shouldFail = true;
    const second = await fetchFxRate("USD", "CNY");
    assert.equal(second.source, "recent_cache");
    assert.equal(second.rate, 6.88);
    assert.equal(second.is_stale, true);
    assert.ok(Number(second.age_ms) >= 0);
  } finally {
    global.fetch = originalFetch;
    __resetRecentFxCacheForTests();
  }
});

test("throws when no provider and no recent quote in strict mode", async () => {
  __resetRecentFxCacheForTests();
  const originalFetch = global.fetch;
  global.fetch = async () => {
    throw new Error("provider unavailable");
  };
  try {
    await assert.rejects(
      async () => fetchFxRate("USD", "CNY"),
      (error) => String(error?.code || "") === "FX_QUOTE_UNAVAILABLE"
    );
  } finally {
    global.fetch = originalFetch;
    __resetRecentFxCacheForTests();
  }
});
