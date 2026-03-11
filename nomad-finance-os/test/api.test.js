const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { createDb } = require("../src/db");
const { createApp } = require("../src/app");

function createHarness() {
  const db = createDb(":memory:");
  const app = createApp(db);
  const api = request(app);
  return { db, api };
}

async function withMockedFetchJson(jsonPayload, fn) {
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => jsonPayload
  });
  try {
    return await fn();
  } finally {
    global.fetch = originalFetch;
  }
}

async function createAccount(api, payload) {
  const res = await api.post("/api/v1/accounts").send(payload);
  assert.equal(res.status, 201);
  return res.body;
}

test("expense supports l1/l2/tag and budget only at l1 level", async () => {
  const { api } = createHarness();
  const month = "2026-03";
  const date = "2026-03-10";

  const cash = await createAccount(api, {
    name: "Wallet",
    type: "cash",
    currency: "USD",
    balance: 500
  });

  const expenseRes = await api.post("/api/v1/transactions").send({
    date,
    type: "expense",
    amount_original: 20,
    currency_original: "USD",
    fx_rate: 1,
    category_l1: "Living",
    category_l2: "Groceries",
    account_from_id: cash.id,
    tags: ["food", "bangkok"],
    note: "lunch"
  });
  assert.equal(expenseRes.status, 201);
  assert.deepEqual(expenseRes.body.tags.sort(), ["bangkok", "food"]);
  assert.equal(expenseRes.body.category_l1, "Living");
  assert.equal(expenseRes.body.category_l2, "Groceries");

  const taggedRes = await api
    .get(`/api/v1/transactions?month=${month}&tag=food`)
    .send();
  assert.equal(taggedRes.status, 200);
  assert.equal(taggedRes.body.length, 1);
  assert.equal(taggedRes.body[0].category_l1, "Living");

  const budgetRes = await api.post("/api/v1/budgets").send({
    month,
    category_l1: "Living",
    total_amount: 10
  });
  assert.equal(budgetRes.status, 201);

  const budgetListRes = await api.get(`/api/v1/budgets?month=${month}`).send();
  assert.equal(budgetListRes.status, 200);
  assert.equal(budgetListRes.body.length, 1);
  assert.equal(budgetListRes.body[0].category_l1, "Living");
  assert.equal(budgetListRes.body[0].spent_amount, 20);
  assert.equal(budgetListRes.body[0].overspend, true);
});

test("deposit lock/release/forfeit follows restricted cash accounting rules", async () => {
  const { api } = createHarness();
  const month = "2026-03";
  const date = "2026-03-10";

  const cash = await createAccount(api, {
    name: "Main Cash",
    type: "cash",
    currency: "USD",
    balance: 1000
  });
  const depositAccount = await createAccount(api, {
    name: "Rent Deposit",
    type: "restricted_cash",
    currency: "USD",
    balance: 0
  });

  const lockRes = await api.post("/api/v1/transactions").send({
    date,
    type: "transfer",
    amount_original: 200,
    currency_original: "USD",
    fx_rate: 1,
    account_from_id: cash.id,
    account_to_id: depositAccount.id,
    transfer_reason: "deposit_lock",
    note: "deposit paid"
  });
  assert.equal(lockRes.status, 201);

  const dashboardAfterLock = await api.get(`/api/v1/dashboard?month=${month}`).send();
  assert.equal(dashboardAfterLock.status, 200);
  assert.equal(dashboardAfterLock.body.net_worth, 1000);
  assert.equal(dashboardAfterLock.body.liquid_cash, 800);
  assert.equal(dashboardAfterLock.body.restricted_cash_total, 200);
  assert.equal(dashboardAfterLock.body.monthly_expense, 0);

  const releaseRes = await api.post("/api/v1/transactions").send({
    date,
    type: "transfer",
    amount_original: 50,
    currency_original: "USD",
    fx_rate: 1,
    account_from_id: depositAccount.id,
    account_to_id: cash.id,
    transfer_reason: "deposit_release",
    note: "partial refund"
  });
  assert.equal(releaseRes.status, 201);

  const dashboardAfterRelease = await api.get(`/api/v1/dashboard?month=${month}`).send();
  assert.equal(dashboardAfterRelease.status, 200);
  assert.equal(dashboardAfterRelease.body.net_worth, 1000);
  assert.equal(dashboardAfterRelease.body.liquid_cash, 850);
  assert.equal(dashboardAfterRelease.body.restricted_cash_total, 150);
  assert.equal(dashboardAfterRelease.body.monthly_expense, 0);

  const forfeitRes = await api.post("/api/v1/transactions").send({
    date,
    type: "expense",
    amount_original: 30,
    currency_original: "USD",
    fx_rate: 1,
    category_l1: "Travel",
    category_l2: "Hotels",
    account_from_id: depositAccount.id,
    tags: ["deposit", "forfeit"],
    note: "host kept part of deposit"
  });
  assert.equal(forfeitRes.status, 201);

  const dashboardAfterForfeit = await api.get(`/api/v1/dashboard?month=${month}`).send();
  assert.equal(dashboardAfterForfeit.status, 200);
  assert.equal(dashboardAfterForfeit.body.net_worth, 970);
  assert.equal(dashboardAfterForfeit.body.liquid_cash, 850);
  assert.equal(dashboardAfterForfeit.body.restricted_cash_total, 120);
  assert.equal(dashboardAfterForfeit.body.monthly_expense, 30);
});

test("monthly review separates real expense from transfer volume", async () => {
  const { api } = createHarness();
  const month = "2026-03";
  const date = "2026-03-15";

  const cash = await createAccount(api, {
    name: "Main Cash",
    type: "cash",
    currency: "USD",
    balance: 1000
  });
  const depositAccount = await createAccount(api, {
    name: "Visa Deposit",
    type: "restricted_cash",
    currency: "USD",
    balance: 0
  });

  const txs = [
    {
      type: "transfer",
      amount_original: 120,
      transfer_reason: "deposit_lock",
      account_from_id: cash.id,
      account_to_id: depositAccount.id
    },
    {
      type: "transfer",
      amount_original: 20,
      transfer_reason: "deposit_release",
      account_from_id: depositAccount.id,
      account_to_id: cash.id
    },
    {
      type: "expense",
      amount_original: 45,
      category_l1: "Travel",
      category_l2: "Visa",
      account_from_id: depositAccount.id
    },
    {
      type: "expense",
      amount_original: 15,
      category_l1: "Living",
      category_l2: "Groceries",
      account_from_id: cash.id
    }
  ];

  for (const tx of txs) {
    const body = {
      date,
      currency_original: "USD",
      fx_rate: 1,
      note: "test",
      ...tx
    };
    const res = await api.post("/api/v1/transactions").send(body);
    assert.equal(res.status, 201);
  }

  const reviewRes = await api.get(`/api/v1/reviews/monthly?month=${month}`).send();
  assert.equal(reviewRes.status, 200);
  assert.equal(reviewRes.body.expense_total, 60);
  assert.equal(reviewRes.body.transfer_total, 140);
  assert.equal(reviewRes.body.expense_structure_l1[0].category_l1, "Travel");
  assert.equal(reviewRes.body.top_expenses.length, 2);
  assert.match(reviewRes.body.summary, /Transfer volume/);
});

test("serves web UI shell", async () => {
  const { api } = createHarness();
  const res = await api.get("/").send();
  assert.equal(res.status, 200);
  assert.match(res.text, /Nomad Finance OS/);
});

test("settings + auto FX conversion + runway/risk metrics", async () => {
  const { api } = createHarness();
  const month = "2026-03";
  const date = "2026-03-10";
  const cash = await createAccount(api, {
    name: "Cash USD",
    type: "cash",
    currency: "USD",
    balance: 1000
  });

  const settingsRes = await api.put("/api/v1/settings").send({
    base_currency: "USD",
    timezone: "Asia/Bangkok"
  });
  assert.equal(settingsRes.status, 200);
  assert.equal(settingsRes.body.base_currency, "USD");

  const expenseRes = await api.post("/api/v1/transactions").send({
    date,
    type: "expense",
    amount_original: 355,
    currency_original: "THB",
    category_l1: "Living",
    category_l2: "Groceries",
    account_from_id: cash.id
  });
  assert.equal(expenseRes.status, 201);
  assert.ok(Number(expenseRes.body.amount_base) > 9.9 && Number(expenseRes.body.amount_base) < 10.1);

  const incomeRes = await api.post("/api/v1/transactions").send({
    date,
    type: "income",
    amount_original: 100,
    currency_original: "USD",
    account_to_id: cash.id
  });
  assert.equal(incomeRes.status, 201);

  const runwayRes = await api.get(`/api/v1/metrics/runway?month=${month}`).send();
  assert.equal(runwayRes.status, 200);
  assert.ok("burn_rate" in runwayRes.body);
  assert.ok("runway_months" in runwayRes.body);

  const riskRes = await api.get(`/api/v1/metrics/risk?month=${month}`).send();
  assert.equal(riskRes.status, 200);
  assert.ok("crypto_exposure" in riskRes.body);
  assert.ok("income_volatility" in riskRes.body);
  assert.ok("fixed_cost_ratio" in riskRes.body);
});

test("BYOK provider CRUD + parse-text extraction + confirm flow", async () => {
  const { api } = createHarness();
  const date = "2026-03-10";
  const cash = await createAccount(api, {
    name: "Cash",
    type: "cash",
    currency: "USD",
    balance: 500
  });
  assert.ok(cash.id > 0);

  const providerRes = await api.post("/api/v1/ai/providers").send({
    provider_type: "openai_compatible",
    display_name: "Demo Provider",
    base_url: "https://example.com/v1",
    model: "gpt-4.1-mini",
    api_key: "sk-demo-secret-1234"
  });
  assert.equal(providerRes.status, 201);
  assert.equal(providerRes.body.key_masked.endsWith("1234"), true);

  const providers = await api.get("/api/v1/ai/providers").send();
  assert.equal(providers.status, 200);
  assert.equal(providers.body.length, 1);

  const parseRes = await withMockedFetchJson(
    {
      choices: [
        {
          message: {
            content: JSON.stringify({
              type: "expense",
              amount_original: 20,
              currency_original: "USD",
              category_l1: "Living",
              category_l2: "Groceries",
              confidence: 0.95
            })
          }
        }
      ]
    },
    async () =>
      api.post("/api/v1/transactions/parse-text").send({
        text: "Lunch 20 USD",
        provider_id: providerRes.body.id
      })
  );
  assert.equal(parseRes.status, 201);
  assert.ok(parseRes.body.extraction_id > 0);
  assert.equal(parseRes.body.draft.type, "expense");

  const confirmRes = await api.post("/api/v1/transactions/confirm-extraction").send({
    extraction_id: parseRes.body.extraction_id,
    overrides: {
      date,
      account_from_id: cash.id,
      category_l1: "Living",
      category_l2: "Groceries"
    }
  });
  assert.equal(confirmRes.status, 201);
  assert.equal(confirmRes.body.type, "expense");
});

test("yearly budgets + monthly snapshot generation", async () => {
  const { api } = createHarness();
  const year = 2026;
  const month = "2026-03";

  const yearlyUpsert = await api.post("/api/v1/budgets/yearly").send({
    year,
    category_l1: "Travel",
    total_amount: 8000
  });
  assert.equal(yearlyUpsert.status, 201);

  const yearlyList = await api.get(`/api/v1/budgets/yearly?year=${year}`).send();
  assert.equal(yearlyList.status, 200);
  assert.equal(yearlyList.body.length, 1);
  assert.equal(yearlyList.body[0].category_l1, "Travel");

  const snapshotRes = await api.post("/api/v1/reviews/monthly/generate").send({ month });
  assert.equal(snapshotRes.status, 201);
  assert.equal(snapshotRes.body.month, month);
});

test("parse-image without provider is rejected (AI required)", async () => {
  const { api } = createHarness();
  const res = await api.post("/api/v1/transactions/parse-image").send({
    image_base64: "data:image/png;base64,AAA"
  });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /No active AI provider configured/i);
});

test("analytics summary returns key event counters", async () => {
  const { api } = createHarness();
  const month = "2026-03";
  const cash = await createAccount(api, {
    name: "Cash",
    type: "cash",
    currency: "USD",
    balance: 300
  });

  const txRes = await api.post("/api/v1/transactions").send({
    date: "2026-03-11",
    type: "expense",
    amount_original: 25,
    currency_original: "USD",
    fx_rate: 1,
    category_l1: "Lifestyle",
    category_l2: "Dining",
    account_from_id: cash.id
  });
  assert.equal(txRes.status, 201);

  const reviewOpen = await api.get(`/api/v1/reviews/monthly?month=${month}`).send();
  assert.equal(reviewOpen.status, 200);

  const analytics = await api.get(`/api/v1/analytics/summary?month=${month}`).send();
  assert.equal(analytics.status, 200);
  assert.ok(analytics.body.events.transaction_created >= 1);
  assert.ok(analytics.body.events.monthly_review_opened >= 1);
});

test("account balances are updated in account currency, dashboard unified in base currency", async () => {
  const { api } = createHarness();
  const month = "2026-03";

  await api.put("/api/v1/settings").send({
    base_currency: "USD",
    timezone: "UTC"
  });

  const cnyAccount = await createAccount(api, {
    name: "CNY Wallet",
    type: "cash",
    currency: "CNY",
    balance: 0
  });

  const incomeRes = await api.post("/api/v1/transactions").send({
    date: "2026-03-12",
    type: "income",
    amount_original: 100,
    currency_original: "USD",
    fx_rate: 1,
    account_to_id: cnyAccount.id,
    note: "salary"
  });
  assert.equal(incomeRes.status, 201);
  assert.equal(incomeRes.body.amount_base, 100);

  const accountsRes = await api.get("/api/v1/accounts").send();
  assert.equal(accountsRes.status, 200);
  const cnyAfter = accountsRes.body.find((x) => x.id === cnyAccount.id);
  assert.ok(cnyAfter);
  assert.equal(Number(cnyAfter.opening_balance), 0);
  assert.ok(Number(cnyAfter.balance) > 719 && Number(cnyAfter.balance) < 721);

  const dashboardRes = await api.get(`/api/v1/dashboard?month=${month}`).send();
  assert.equal(dashboardRes.status, 200);
  assert.ok(dashboardRes.body.monthly_income > 99 && dashboardRes.body.monthly_income < 101);
  assert.ok(dashboardRes.body.net_worth > 99 && dashboardRes.body.net_worth < 101);
});

test("admin rebuild-balances recalculates account balances from opening balance + ledger", async () => {
  const { db, api } = createHarness();
  const cnyAccount = await createAccount(api, {
    name: "CNY Wallet",
    type: "cash",
    currency: "CNY",
    balance: 0
  });

  const incomeRes = await api.post("/api/v1/transactions").send({
    date: "2026-03-12",
    type: "income",
    amount_original: 100,
    currency_original: "USD",
    account_to_id: cnyAccount.id
  });
  assert.equal(incomeRes.status, 201);

  db.prepare("UPDATE accounts SET balance = 1 WHERE id = ?").run(cnyAccount.id);
  const rebuildRes = await api.post("/api/v1/admin/rebuild-balances").send({});
  assert.equal(rebuildRes.status, 201);
  const row = rebuildRes.body.accounts.find((x) => x.id === cnyAccount.id);
  assert.ok(row);
  assert.equal(Number(row.previous_balance), 1);
  assert.ok(Number(row.recalculated_balance) > 719 && Number(row.recalculated_balance) < 721);
});

test("parse-text handles baht alias and maps travel phrase to lifestyle", async () => {
  const { api } = createHarness();
  const account = await createAccount(api, {
    name: "Main Wallet",
    type: "cash",
    currency: "USD",
    balance: 1000
  });
  assert.ok(account.id > 0);

  const providerRes = await api.post("/api/v1/ai/providers").send({
    provider_type: "openai_compatible",
    display_name: "Demo Provider",
    base_url: "https://example.com/v1",
    model: "gpt-4.1-mini",
    api_key: "sk-demo-secret-5678"
  });
  assert.equal(providerRes.status, 201);

  const parseRes = await withMockedFetchJson(
    {
      choices: [
        {
          message: {
            content: JSON.stringify({
              type: "expense",
              amount_original: 10000,
              currency_original: "Baht",
              category_l1: "Lifestyle",
              category_l2: "Entertainment",
              note: "旅游花了10000泰铢"
            })
          }
        }
      ]
    },
    async () =>
      api.post("/api/v1/transactions/parse-text").send({
        text: "旅游花了10000泰铢"
      })
  );
  assert.equal(parseRes.status, 201);
  assert.equal(parseRes.body.draft.amount_original, 10000);
  assert.equal(parseRes.body.draft.currency_original, "THB");
  assert.equal(parseRes.body.draft.type, "expense");
  assert.equal(parseRes.body.draft.category_l1, "Lifestyle");
  assert.equal(parseRes.body.draft.category_l2, "Entertainment");
});

test("changing base currency changes monthly income/expense display values", async () => {
  const { api } = createHarness();
  const month = "2026-03";
  const account = await createAccount(api, {
    name: "USD Wallet",
    type: "cash",
    currency: "USD",
    balance: 0
  });

  const txRes = await api.post("/api/v1/transactions").send({
    date: "2026-03-18",
    type: "income",
    amount_original: 100,
    currency_original: "USD",
    account_to_id: account.id
  });
  assert.equal(txRes.status, 201);
  const expenseRes = await api.post("/api/v1/transactions").send({
    date: "2026-03-18",
    type: "expense",
    amount_original: 10,
    currency_original: "USD",
    category_l1: "Lifestyle",
    category_l2: "Dining",
    account_from_id: account.id
  });
  assert.equal(expenseRes.status, 201);

  const before = await api.get(`/api/v1/dashboard?month=${month}`).send();
  assert.equal(before.status, 200);
  assert.ok(before.body.monthly_income > 99 && before.body.monthly_income < 101);
  assert.ok(before.body.monthly_expense > 9 && before.body.monthly_expense < 11);

  const settingRes = await api.put("/api/v1/settings").send({ base_currency: "CNY" });
  assert.equal(settingRes.status, 200);
  assert.equal(settingRes.body.base_currency, "CNY");

  const after = await api.get(`/api/v1/dashboard?month=${month}`).send();
  assert.equal(after.status, 200);
  assert.ok(after.body.monthly_income > 719 && after.body.monthly_income < 721);
  assert.ok(after.body.monthly_expense > 71 && after.body.monthly_expense < 73);
});

test("crypto exposure never negative even when net worth is negative", async () => {
  const { api } = createHarness();
  const crypto = await createAccount(api, {
    name: "Exchange",
    type: "exchange",
    currency: "USD",
    balance: 100
  });
  assert.ok(crypto.id > 0);
  const liabilityLike = await createAccount(api, {
    name: "Debt Proxy",
    type: "bank",
    currency: "USD",
    balance: -1000
  });
  assert.ok(liabilityLike.id > 0);

  const riskRes = await api.get("/api/v1/metrics/risk?month=2026-03").send();
  assert.equal(riskRes.status, 200);
  assert.ok(riskRes.body.crypto_exposure >= 0);
  assert.ok(riskRes.body.crypto_exposure <= 1);
});
