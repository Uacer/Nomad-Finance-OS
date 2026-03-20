const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { createDb } = require("../src/db");
const { createApp } = require("../src/app");

function createHarness(options = {}) {
  const allowDevBypass = options.allowDevBypass !== undefined ? Boolean(options.allowDevBypass) : true;
  const agentApiKey =
    options.agentApiKey !== undefined ? String(options.agentApiKey || "") : "test-agent-key";
  const previousBypass = process.env.AUTH_ALLOW_DEV_BYPASS;
  process.env.AUTH_ALLOW_DEV_BYPASS = allowDevBypass ? "1" : "0";
  if (agentApiKey) {
    process.env.NOMAD_AGENT_API_KEY = agentApiKey;
  } else {
    delete process.env.NOMAD_AGENT_API_KEY;
  }
  delete process.env.OPENAI_API_KEY;
  const db = createDb(":memory:");
  const app = createApp(db);
  if (previousBypass === undefined) {
    delete process.env.AUTH_ALLOW_DEV_BYPASS;
  } else {
    process.env.AUTH_ALLOW_DEV_BYPASS = previousBypass;
  }
  const rawApi = request.agent(app);
  const api = createBypassApiClient(rawApi, 1);
  return { db, app, api, rawApi };
}

function createBypassApiClient(rawApi, userId = 1) {
  const methods = ["get", "post", "put", "patch", "delete"];
  const wrapped = {};
  for (const method of methods) {
    wrapped[method] = (url) => rawApi[method](url).set("x-user-id", String(userId));
  }
  return wrapped;
}

function createBearerApiClient(rawApi, token) {
  const methods = ["get", "post", "put", "patch", "delete"];
  const wrapped = {};
  for (const method of methods) {
    wrapped[method] = (url) => rawApi[method](url).set("authorization", `Bearer ${token}`);
  }
  return wrapped;
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

async function signInViaEmailCode(rawApi, email = "agent-user@example.com") {
  const previousResendKey = process.env.RESEND_API_KEY;
  const previousResendFrom = process.env.RESEND_FROM_EMAIL;
  process.env.RESEND_API_KEY = "re_test_key";
  process.env.RESEND_FROM_EMAIL = "noreply@example.com";
  const originalFetch = global.fetch;
  let lastEmailPayload = null;
  global.fetch = async (url, init) => {
    const href = String(url || "");
    if (!href.includes("api.resend.com/emails")) {
      throw new Error(`Unexpected URL in mocked fetch: ${href}`);
    }
    lastEmailPayload = JSON.parse(String(init?.body || "{}"));
    return {
      ok: true,
      status: 200,
      json: async () => ({ id: "mail_mock_login" })
    };
  };
  try {
    const syntheticIp = `198.18.0.${Math.max(1, Math.floor(Math.random() * 200))}`;
    const requestRes = await rawApi
      .post("/api/v1/auth/code/request")
      .set("x-forwarded-for", syntheticIp)
      .send({ email });
    assert.equal(requestRes.status, 200);
    const text = String(lastEmailPayload?.text || "");
    const codeMatch = text.match(/\b\d{6}\b/);
    assert.ok(codeMatch && codeMatch[0], "verification code should exist in resend payload");
    const verifyRes = await rawApi.post("/api/v1/auth/code/verify").send({
      email,
      code: codeMatch[0]
    });
    assert.equal(verifyRes.status, 200);
    const sessionRes = await rawApi.get("/api/v1/auth/session").send();
    assert.equal(sessionRes.status, 200);
    assert.equal(sessionRes.body.authenticated, true);
    return sessionRes.body.user;
  } finally {
    global.fetch = originalFetch;
    if (previousResendKey === undefined) {
      delete process.env.RESEND_API_KEY;
    } else {
      process.env.RESEND_API_KEY = previousResendKey;
    }
    if (previousResendFrom === undefined) {
      delete process.env.RESEND_FROM_EMAIL;
    } else {
      process.env.RESEND_FROM_EMAIL = previousResendFrom;
    }
  }
}

async function withMockedFxRate(rateByPair, fn) {
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    const href = String(url || "");
    const parsed = new URL(href, "http://localhost");
    const base = String(parsed.searchParams.get("base") || parsed.searchParams.get("source") || "USD").toUpperCase();
    let symbol =
      String(parsed.searchParams.get("symbols") || parsed.searchParams.get("currencies") || "")
        .split(",")
        .map((x) => x.trim().toUpperCase())
        .filter(Boolean)[0] || "USD";
    if (!symbol && parsed.searchParams.get("currencies")) symbol = "USD";
    const key = `${base}->${symbol}`;
    const direct = Number(rateByPair?.[key]);
    if (!Number.isFinite(direct) || direct <= 0) {
      return {
        ok: false,
        status: 503,
        json: async () => ({})
      };
    }
    if (href.includes("/live?")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          quotes: {
            [`${base}${symbol}`]: direct
          }
        })
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        rates: {
          [symbol]: direct
        }
      })
    };
  };
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

test("deleting l2 category keeps historical transactions unchanged", async () => {
  const { api } = createHarness();
  const month = "2026-03";
  const cash = await createAccount(api, {
    name: "Wallet",
    type: "cash",
    currency: "USD",
    balance: 500
  });

  const expenseRes = await api.post("/api/v1/transactions").send({
    date: "2026-03-10",
    type: "expense",
    amount_original: 20,
    currency_original: "USD",
    fx_rate: 1,
    category_l1: "Living",
    category_l2: "Groceries",
    account_from_id: cash.id,
    note: "before delete"
  });
  assert.equal(expenseRes.status, 201);

  const deleteRes = await api.delete("/api/v1/categories/l2").send({
    l1_name: "Living",
    name: "Groceries"
  });
  assert.equal(deleteRes.status, 200);
  assert.equal(deleteRes.body.active, false);

  const txRes = await api.get(`/api/v1/transactions?month=${month}`).send();
  assert.equal(txRes.status, 200);
  assert.equal(txRes.body.length, 1);
  assert.equal(txRes.body[0].category_l1, "Living");
  assert.equal(txRes.body[0].category_l2, "Groceries");

  const createAfterDeleteRes = await api.post("/api/v1/transactions").send({
    date: "2026-03-11",
    type: "expense",
    amount_original: 15,
    currency_original: "USD",
    fx_rate: 1,
    category_l1: "Living",
    category_l2: "Groceries",
    account_from_id: cash.id
  });
  assert.equal(createAfterDeleteRes.status, 400);
  assert.match(String(createAfterDeleteRes.body.error || ""), /Invalid active expense category pair/i);
});

test("renaming l1 category updates transactions and budgets references", async () => {
  const { api } = createHarness();
  const month = "2026-03";
  const year = 2026;
  const cash = await createAccount(api, {
    name: "Wallet",
    type: "cash",
    currency: "USD",
    balance: 300
  });

  const txRes = await api.post("/api/v1/transactions").send({
    date: "2026-03-11",
    type: "expense",
    amount_original: 25,
    currency_original: "USD",
    category_l1: "Living",
    category_l2: "Groceries",
    account_from_id: cash.id,
    note: "groceries"
  });
  assert.equal(txRes.status, 201);

  const monthBudgetRes = await api.post("/api/v1/budgets").send({
    month,
    category_l1: "Living",
    total_amount: 120
  });
  assert.equal(monthBudgetRes.status, 201);

  const yearlyBudgetRes = await api.post("/api/v1/budgets/yearly").send({
    year,
    category_l1: "Living",
    total_amount: 1200
  });
  assert.equal(yearlyBudgetRes.status, 201);

  const renameRes = await api.put("/api/v1/categories/l1/rename").send({
    old_name: "Living",
    new_name: "Home"
  });
  assert.equal(renameRes.status, 200);

  const categoriesRes = await api.get("/api/v1/categories").send();
  assert.equal(categoriesRes.status, 200);
  assert.ok(categoriesRes.body.Home);
  assert.equal(categoriesRes.body.Living, undefined);

  const txListRes = await api.get(`/api/v1/transactions?month=${month}`).send();
  assert.equal(txListRes.status, 200);
  assert.equal(txListRes.body.length, 1);
  assert.equal(txListRes.body[0].category_l1, "Home");
  assert.equal(txListRes.body[0].category_l2, "Groceries");

  const monthBudgetListRes = await api.get(`/api/v1/budgets?month=${month}`).send();
  assert.equal(monthBudgetListRes.status, 200);
  assert.equal(monthBudgetListRes.body.length, 1);
  assert.equal(monthBudgetListRes.body[0].category_l1, "Home");

  const yearlyBudgetListRes = await api.get(`/api/v1/budgets/yearly?year=${year}`).send();
  assert.equal(yearlyBudgetListRes.status, 200);
  assert.equal(yearlyBudgetListRes.body.length, 1);
  assert.equal(yearlyBudgetListRes.body[0].category_l1, "Home");
});

test("transfer supports one-sided loan and borrow reasons", async () => {
  const { api } = createHarness();
  const month = "2026-03";
  const lender = await createAccount(api, {
    name: "Lender Wallet",
    type: "cash",
    currency: "USD",
    balance: 500
  });
  const borrower = await createAccount(api, {
    name: "Borrow Wallet",
    type: "cash",
    currency: "USD",
    balance: 100
  });

  const loanRes = await api.post("/api/v1/transactions").send({
    date: "2026-03-12",
    type: "transfer",
    amount_original: 50,
    currency_original: "USD",
    account_from_id: lender.id,
    transfer_reason: "loan",
    note: "lend to friend"
  });
  assert.equal(loanRes.status, 201);
  assert.equal(loanRes.body.transfer_reason, "loan");
  assert.equal(loanRes.body.account_from_id, lender.id);
  assert.equal(loanRes.body.account_to_id, null);

  const borrowRes = await api.post("/api/v1/transactions").send({
    date: "2026-03-13",
    type: "transfer",
    amount_original: 80,
    currency_original: "USD",
    account_to_id: borrower.id,
    transfer_reason: "borrow",
    note: "borrow from friend"
  });
  assert.equal(borrowRes.status, 201);
  assert.equal(borrowRes.body.transfer_reason, "borrow");
  assert.equal(borrowRes.body.account_from_id, null);
  assert.equal(borrowRes.body.account_to_id, borrower.id);

  const accountsRes = await api.get("/api/v1/accounts").send();
  assert.equal(accountsRes.status, 200);
  const lenderAfter = accountsRes.body.find((row) => row.id === lender.id);
  const borrowerAfter = accountsRes.body.find((row) => row.id === borrower.id);
  assert.equal(Number(lenderAfter.balance), 450);
  assert.equal(Number(borrowerAfter.balance), 180);

  const txRes = await api.get(`/api/v1/transactions?month=${month}`).send();
  assert.equal(txRes.status, 200);
  assert.equal(txRes.body.length, 2);
  assert.deepEqual(
    txRes.body.map((row) => row.transfer_reason).sort(),
    ["borrow", "loan"]
  );
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
  await withMockedFxRate({ "THB->USD": 0.02816901 }, async () => {
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
    const fxRate = Number(expenseRes.body.fx_rate);
    const amountBase = Number(expenseRes.body.amount_base);
    assert.ok(Number.isFinite(fxRate) && fxRate > 0);
    assert.ok(Number.isFinite(amountBase) && amountBase > 0);
    assert.ok(Math.abs(amountBase - Number((355 * fxRate).toFixed(8))) < 0.000001);

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
});

test("rejects unsupported currencies for settings and accounts", async () => {
  const { api } = createHarness();
  const settingsRes = await api.put("/api/v1/settings").send({
    base_currency: "SGD"
  });
  assert.equal(settingsRes.status, 400);
  assert.match(settingsRes.body.error, /base_currency must be one of/i);

  const accountRes = await api.post("/api/v1/accounts").send({
    name: "Bad Currency Account",
    type: "cash",
    currency: "GBP",
    balance: 0
  });
  assert.equal(accountRes.status, 400);
  assert.match(accountRes.body.error, /currency must be one of/i);
});

test("settings persists ui_language", async () => {
  const { api } = createHarness();
  const initial = await api.get("/api/v1/settings").send();
  assert.equal(initial.status, 200);
  assert.equal(initial.body.ui_language, "en");

  const update = await api.put("/api/v1/settings").send({
    ui_language: "zh"
  });
  assert.equal(update.status, 200);
  assert.equal(update.body.ui_language, "zh");

  const after = await api.get("/api/v1/settings").send();
  assert.equal(after.status, 200);
  assert.equal(after.body.ui_language, "zh");
});

test("parse-text extraction + confirm flow", async () => {
  const { api } = createHarness();
  const date = "2026-03-10";
  const cash = await createAccount(api, {
    name: "Cash",
    type: "cash",
    currency: "USD",
    balance: 500
  });
  assert.ok(cash.id > 0);

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
    async () => api.post("/api/v1/transactions/parse-text").send({ text: "Lunch 20 USD" })
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

  const dashboardRes = await api.get(`/api/v1/dashboard?month=${month}`).send();
  assert.equal(dashboardRes.status, 200);
  assert.equal((dashboardRes.body.budget_status_yearly || []).length, 1);
  assert.equal(dashboardRes.body.budget_status_yearly[0].category_l1, "Travel");

  const snapshotRes = await api.post("/api/v1/reviews/monthly/generate").send({ month });
  assert.equal(snapshotRes.status, 201);
  assert.equal(snapshotRes.body.month, month);
});

test("parse-image returns 503 when AI agent is not configured", async () => {
  const { api } = createHarness({ agentApiKey: "" });
  const res = await api.post("/api/v1/transactions/parse-image").send({
    image_base64: "data:image/png;base64,AAA"
  });
  assert.equal(res.status, 503);
  assert.match(res.body.error, /AI agent is not configured/i);
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
  await withMockedFxRate({ "USD->CNY": 7.2 }, async () => {
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
});

test("account edit supports changing account type and balance together", async () => {
  const { api } = createHarness();
  const account = await createAccount(api, {
    name: "Wallet To Edit",
    type: "bank",
    currency: "USD",
    balance: 100
  });

  const patchRes = await api.patch(`/api/v1/accounts/${account.id}`).send({
    type: "crypto_wallet",
    balance: 250
  });
  assert.equal(patchRes.status, 200);
  assert.equal(patchRes.body.type, "crypto_wallet");
  assert.equal(Number(patchRes.body.balance), 250);

  const accountsRes = await api.get("/api/v1/accounts").send();
  assert.equal(accountsRes.status, 200);
  const updated = accountsRes.body.find((row) => row.id === account.id);
  assert.ok(updated);
  assert.equal(updated.type, "crypto_wallet");
  assert.equal(Number(updated.balance), 250);
});

test("transaction supports update and delete with balance rebuild", async () => {
  const { api } = createHarness();
  const from = await createAccount(api, {
    name: "Main Wallet",
    type: "cash",
    currency: "USD",
    balance: 200
  });

  const createRes = await api.post("/api/v1/transactions").send({
    date: "2026-03-13",
    type: "expense",
    amount_original: 50,
    currency_original: "USD",
    category_l1: "Lifestyle",
    category_l2: "Dining",
    account_from_id: from.id,
    note: "dinner"
  });
  assert.equal(createRes.status, 201);
  const txId = createRes.body.id;

  const patchRes = await api.patch(`/api/v1/transactions/${txId}`).send({
    date: "2026-03-13",
    type: "expense",
    amount_original: 20,
    currency_original: "USD",
    category_l1: "Lifestyle",
    category_l2: "Dining",
    account_from_id: from.id,
    note: "light dinner",
    tags: ["food"]
  });
  assert.equal(patchRes.status, 200);
  assert.equal(Number(patchRes.body.amount_original), 20);
  assert.equal(patchRes.body.note, "light dinner");

  const accountAfterPatch = (await api.get("/api/v1/accounts").send()).body.find((row) => row.id === from.id);
  assert.ok(accountAfterPatch);
  assert.equal(Number(accountAfterPatch.balance), 180);

  const deleteRes = await api.delete(`/api/v1/transactions/${txId}`).send();
  assert.equal(deleteRes.status, 200);

  const accountAfterDelete = (await api.get("/api/v1/accounts").send()).body.find((row) => row.id === from.id);
  assert.ok(accountAfterDelete);
  assert.equal(Number(accountAfterDelete.balance), 200);
});

test("admin rebuild-balances recalculates account balances from opening balance + ledger", async () => {
  await withMockedFxRate({ "USD->CNY": 7.2 }, async () => {
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
});

test("force delete account removes linked transactions and rebuilds remaining account balances", async () => {
  const { api } = createHarness();
  const month = "2026-03";
  const from = await createAccount(api, {
    name: "From Wallet",
    type: "cash",
    currency: "USD",
    balance: 100
  });
  const to = await createAccount(api, {
    name: "To Wallet",
    type: "cash",
    currency: "USD",
    balance: 50
  });

  const transferRes = await api.post("/api/v1/transactions").send({
    date: "2026-03-10",
    type: "transfer",
    amount_original: 20,
    currency_original: "USD",
    account_from_id: from.id,
    account_to_id: to.id,
    transfer_reason: "normal"
  });
  assert.equal(transferRes.status, 201);

  const safeDeleteRes = await api.delete(`/api/v1/accounts/${from.id}`).send();
  assert.equal(safeDeleteRes.status, 409);
  assert.equal(safeDeleteRes.body.error_code, "ACCOUNT_LINKED_TRANSACTIONS");
  assert.equal(safeDeleteRes.body.linked_transactions, 1);

  const forceDeleteRes = await api.delete(`/api/v1/accounts/${from.id}?force=true`).send();
  assert.equal(forceDeleteRes.status, 200);
  assert.equal(forceDeleteRes.body.forced, true);
  assert.equal(forceDeleteRes.body.deleted_transactions, 1);

  const accountsRes = await api.get("/api/v1/accounts").send();
  assert.equal(accountsRes.status, 200);
  assert.equal(accountsRes.body.length, 1);
  assert.equal(accountsRes.body[0].id, to.id);
  assert.equal(Number(accountsRes.body[0].balance), 50);

  const txRes = await api.get(`/api/v1/transactions?month=${month}`).send();
  assert.equal(txRes.status, 200);
  assert.equal(txRes.body.length, 0);
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

  const originalFetch = global.fetch;
  let parseRes;
  global.fetch = async (url) => {
    const href = String(url || "");
    if (href.includes("/chat/completions")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
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
        })
      };
    }
    const parsed = new URL(href, "http://localhost");
    const base = String(parsed.searchParams.get("base") || parsed.searchParams.get("source") || "USD").toUpperCase();
    const symbol =
      String(parsed.searchParams.get("symbols") || parsed.searchParams.get("currencies") || "")
        .split(",")
        .map((x) => x.trim().toUpperCase())
        .filter(Boolean)[0] || "USD";
    if (base === "THB" && symbol === "USD") {
      return {
        ok: true,
        status: 200,
        json: async () => ({ rates: { USD: 0.02816901 } })
      };
    }
    return {
      ok: false,
      status: 503,
      json: async () => ({})
    };
  };
  try {
    parseRes = await api.post("/api/v1/transactions/parse-text").send({
      text: "旅游花了10000泰铢"
    });
  } finally {
    global.fetch = originalFetch;
  }
  assert.equal(parseRes.status, 201);
  assert.equal(parseRes.body.draft.amount_original, 10000);
  assert.equal(parseRes.body.draft.currency_original, "THB");
  assert.equal(parseRes.body.draft.type, "expense");
  assert.equal(parseRes.body.draft.category_l1, "Lifestyle");
  assert.equal(parseRes.body.draft.category_l2, "Entertainment");
});

test("changing base currency changes monthly income/expense display values", async () => {
  await withMockedFxRate({ "USD->CNY": 7.2 }, async () => {
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
});

test("historical transactions stay fixed when fx providers are unavailable later", async () => {
  const { api } = createHarness();
  const month = "2026-03";
  const originalFetch = global.fetch;
  try {
    global.fetch = async (url) => {
      const href = String(url || "");
      const parsed = new URL(href, "http://localhost");
      const base = String(parsed.searchParams.get("base") || parsed.searchParams.get("source") || "USD").toUpperCase();
      const symbol =
        String(parsed.searchParams.get("symbols") || parsed.searchParams.get("currencies") || "")
          .split(",")
          .map((x) => x.trim().toUpperCase())
          .filter(Boolean)[0] || "USD";
      if (base === "USD" && symbol === "CNY") {
        if (href.includes("/live?")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ success: true, quotes: { USDCNY: 7.2 } })
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ rates: { CNY: 7.2 } })
        };
      }
      return {
        ok: false,
        status: 503,
        json: async () => ({})
      };
    };
    const settingRes = await api.put("/api/v1/settings").send({ base_currency: "CNY" });
    assert.equal(settingRes.status, 200);
    const account = await createAccount(api, {
      name: "CNY Wallet",
      type: "cash",
      currency: "CNY",
      balance: 0
    });

    const createRes = await api.post("/api/v1/transactions").send({
      date: "2026-03-19",
      type: "income",
      amount_original: 100,
      currency_original: "USD",
      account_to_id: account.id
    });
    assert.equal(createRes.status, 201);
    assert.ok(Number(createRes.body.amount_base) > 719 && Number(createRes.body.amount_base) < 721);

    global.fetch = async () => ({
      ok: false,
      status: 503,
      json: async () => ({})
    });

    const txRes = await api.get(`/api/v1/transactions?month=${month}`).send();
    assert.equal(txRes.status, 200);
    assert.equal(txRes.body.length, 1);
    assert.ok(Number(txRes.body[0].amount_base) > 719 && Number(txRes.body[0].amount_base) < 721);
    assert.equal(Number(txRes.body[0].amount_base), Number(txRes.body[0].amount_base_snapshot));
    assert.ok(Number(txRes.body[0].effective_fx_rate) > 7.19 && Number(txRes.body[0].effective_fx_rate) < 7.21);
  } finally {
    global.fetch = originalFetch;
  }
});

test("changing base currency also converts monthly/yearly budget totals", async () => {
  await withMockedFxRate({ "USD->CNY": 7.2 }, async () => {
    const { api } = createHarness();
    const month = "2026-03";
    const year = 2026;

    const monthlyUpsert = await api.post("/api/v1/budgets").send({
      month,
      category_l1: "Lifestyle",
      total_amount: 100
    });
    assert.equal(monthlyUpsert.status, 201);

    const yearlyUpsert = await api.post("/api/v1/budgets/yearly").send({
      year,
      category_l1: "Travel",
      total_amount: 1200
    });
    assert.equal(yearlyUpsert.status, 201);

    const beforeMonthly = await api.get(`/api/v1/budgets?month=${month}`).send();
    assert.equal(beforeMonthly.status, 200);
    assert.equal(beforeMonthly.body.length, 1);
    assert.ok(beforeMonthly.body[0].total_amount > 99 && beforeMonthly.body[0].total_amount < 101);

    const beforeYearly = await api.get(`/api/v1/budgets/yearly?year=${year}`).send();
    assert.equal(beforeYearly.status, 200);
    assert.equal(beforeYearly.body.length, 1);
    assert.ok(beforeYearly.body[0].total_amount > 1199 && beforeYearly.body[0].total_amount < 1201);

    const settingRes = await api.put("/api/v1/settings").send({ base_currency: "CNY" });
    assert.equal(settingRes.status, 200);
    assert.equal(settingRes.body.base_currency, "CNY");

    const afterMonthly = await api.get(`/api/v1/budgets?month=${month}`).send();
    assert.equal(afterMonthly.status, 200);
    assert.ok(afterMonthly.body[0].total_amount > 719 && afterMonthly.body[0].total_amount < 721);

    const afterYearly = await api.get(`/api/v1/budgets/yearly?year=${year}`).send();
    assert.equal(afterYearly.status, 200);
    assert.ok(afterYearly.body[0].total_amount > 8639 && afterYearly.body[0].total_amount < 8641);

    const dashboard = await api.get(`/api/v1/dashboard?month=${month}`).send();
    assert.equal(dashboard.status, 200);
    const lifestyleBudget = (dashboard.body.budget_status || []).find((row) => row.category_l1 === "Lifestyle");
    assert.ok(lifestyleBudget);
    assert.ok(lifestyleBudget.total_amount > 719 && lifestyleBudget.total_amount < 721);
  });
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

test("api requires auth when no session and no bypass header", async () => {
  const { rawApi } = createHarness();
  const res = await rawApi.get("/api/v1/settings").send();
  assert.equal(res.status, 401);
});

test("email code request -> verify -> session login -> logout flow", async () => {
  const previousResendKey = process.env.RESEND_API_KEY;
  const previousResendFrom = process.env.RESEND_FROM_EMAIL;
  process.env.RESEND_API_KEY = "re_test_key";
  process.env.RESEND_FROM_EMAIL = "noreply@example.com";
  const originalFetch = global.fetch;
  let lastEmailPayload = null;
  global.fetch = async (url, init) => {
    const href = String(url || "");
    if (!href.includes("api.resend.com/emails")) {
      throw new Error(`Unexpected URL in mocked fetch: ${href}`);
    }
    lastEmailPayload = JSON.parse(String(init?.body || "{}"));
    return {
      ok: true,
      status: 200,
      json: async () => ({ id: "mail_mock_1" })
    };
  };

  try {
    const { rawApi } = createHarness();
    const requestRes = await rawApi.post("/api/v1/auth/code/request").send({
      email: "TeSt+login@example.com"
    });
    assert.equal(requestRes.status, 200);
    assert.ok(lastEmailPayload);
    const text = String(lastEmailPayload.text || "");
    const codeMatch = text.match(/\b\d{6}\b/);
    assert.ok(codeMatch && codeMatch[0], "verification code should exist in resend payload");

    const verifyRes = await rawApi.post("/api/v1/auth/code/verify").send({
      email: "test+login@example.com",
      code: codeMatch[0]
    });
    assert.equal(verifyRes.status, 200);
    assert.match(String(verifyRes.headers["set-cookie"] || ""), /nfos_session=/);

    const sessionRes = await rawApi.get("/api/v1/auth/session").send();
    assert.equal(sessionRes.status, 200);
    assert.equal(sessionRes.body.authenticated, true);
    assert.equal(sessionRes.body.user.email, "test+login@example.com");

    const protectedRes = await rawApi.get("/api/v1/settings").send();
    assert.equal(protectedRes.status, 200);

    const repeatVerify = await rawApi.post("/api/v1/auth/code/verify").send({
      email: "test+login@example.com",
      code: codeMatch[0]
    });
    assert.equal(repeatVerify.status, 400);

    const logoutRes = await rawApi.post("/api/v1/auth/logout").send();
    assert.equal(logoutRes.status, 200);

    const sessionAfterLogout = await rawApi.get("/api/v1/auth/session").send();
    assert.equal(sessionAfterLogout.status, 200);
    assert.equal(sessionAfterLogout.body.authenticated, false);

    const protectedAfterLogout = await rawApi.get("/api/v1/settings").send();
    assert.equal(protectedAfterLogout.status, 401);
  } finally {
    global.fetch = originalFetch;
    if (previousResendKey === undefined) {
      delete process.env.RESEND_API_KEY;
    } else {
      process.env.RESEND_API_KEY = previousResendKey;
    }
    if (previousResendFrom === undefined) {
      delete process.env.RESEND_FROM_EMAIL;
    } else {
      process.env.RESEND_FROM_EMAIL = previousResendFrom;
    }
  }
});

test("session user can create/list/revoke agent tokens", async () => {
  const { rawApi } = createHarness({ allowDevBypass: false });
  await signInViaEmailCode(rawApi, "token-owner@example.com");

  const createRes = await rawApi.post("/api/v1/auth/agent-tokens").send({
    name: "My Agent"
  });
  assert.equal(createRes.status, 201);
  assert.equal(createRes.body.name, "My Agent");
  assert.match(String(createRes.body.token || ""), /^nfat_/);
  assert.ok(createRes.body.id > 0);
  assert.ok(String(createRes.body.token_prefix || "").length >= 8);

  const listRes = await rawApi.get("/api/v1/auth/agent-tokens").send();
  assert.equal(listRes.status, 200);
  assert.equal(listRes.body.length, 1);
  assert.equal(listRes.body[0].name, "My Agent");
  assert.equal(listRes.body[0].revoked, false);
  assert.equal("token" in listRes.body[0], false);

  const revokeRes = await rawApi.delete(`/api/v1/auth/agent-tokens/${createRes.body.id}`).send();
  assert.equal(revokeRes.status, 200);
  assert.equal(revokeRes.body.revoked, true);

  const afterRevoke = await rawApi.get("/api/v1/auth/agent-tokens").send();
  assert.equal(afterRevoke.status, 200);
  assert.equal(afterRevoke.body[0].revoked, true);
});

test("bearer token supports parse -> confirm flow with default scopes", async () => {
  const { app, rawApi } = createHarness({ allowDevBypass: false });
  await signInViaEmailCode(rawApi, "parse-owner@example.com");

  const cashRes = await rawApi.post("/api/v1/accounts").send({
    name: "Cash",
    type: "cash",
    currency: "USD",
    balance: 300
  });
  assert.equal(cashRes.status, 201);

  const tokenRes = await rawApi.post("/api/v1/auth/agent-tokens").send({ name: "Parser Agent" });
  assert.equal(tokenRes.status, 201);
  const bearerApi = createBearerApiClient(request.agent(app), tokenRes.body.token);

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
              confidence: 0.91
            })
          }
        }
      ]
    },
    async () => bearerApi.post("/api/v1/transactions/parse-text").send({ text: "Lunch 20 USD" })
  );
  assert.equal(parseRes.status, 201);
  assert.ok(parseRes.body.extraction_id > 0);

  const confirmRes = await bearerApi.post("/api/v1/transactions/confirm-extraction").send({
    extraction_id: parseRes.body.extraction_id,
    overrides: {
      date: "2026-03-14",
      account_from_id: cashRes.body.id,
      category_l1: "Living",
      category_l2: "Groceries"
    }
  });
  assert.equal(confirmRes.status, 201);
  assert.equal(confirmRes.body.type, "expense");
});

test("bearer token scope restricts write access", async () => {
  const { app, rawApi } = createHarness({ allowDevBypass: false });
  await signInViaEmailCode(rawApi, "scope-owner@example.com");

  const tokenRes = await rawApi.post("/api/v1/auth/agent-tokens").send({
    name: "ReadOnly Agent",
    scopes: ["accounts:read"]
  });
  assert.equal(tokenRes.status, 201);

  const bearerApi = createBearerApiClient(request.agent(app), tokenRes.body.token);
  const accountsRes = await bearerApi.get("/api/v1/accounts").send();
  assert.equal(accountsRes.status, 200);

  const createTxRes = await bearerApi.post("/api/v1/transactions").send({
    date: "2026-03-10",
    type: "expense",
    amount_original: 10,
    currency_original: "USD",
    fx_rate: 1,
    category_l1: "Living",
    category_l2: "Groceries",
    account_from_id: 1
  });
  assert.equal(createTxRes.status, 403);
});

test("bearer token is isolated by user and revoked token is rejected", async () => {
  const { app, rawApi } = createHarness({ allowDevBypass: false });
  const userA = await signInViaEmailCode(rawApi, "user-a@example.com");
  const aAccount = await rawApi.post("/api/v1/accounts").send({
    name: "A Wallet",
    type: "cash",
    currency: "USD",
    balance: 100
  });
  assert.equal(aAccount.status, 201);
  const tokenRes = await rawApi.post("/api/v1/auth/agent-tokens").send({ name: "A Agent" });
  assert.equal(tokenRes.status, 201);

  const rawApiB = request.agent(app);
  const userB = await signInViaEmailCode(rawApiB, "user-b@example.com");
  assert.notEqual(userA.id, userB.id);
  const bAccount = await rawApiB.post("/api/v1/accounts").send({
    name: "B Wallet",
    type: "cash",
    currency: "USD",
    balance: 200
  });
  assert.equal(bAccount.status, 201);

  const bearerApi = createBearerApiClient(request.agent(app), tokenRes.body.token);
  const accountsBefore = await bearerApi.get("/api/v1/accounts").send();
  assert.equal(accountsBefore.status, 200);
  assert.equal(accountsBefore.body.length, 1);
  assert.equal(accountsBefore.body[0].name, "A Wallet");

  const revokeRes = await rawApi.delete(`/api/v1/auth/agent-tokens/${tokenRes.body.id}`).send();
  assert.equal(revokeRes.status, 200);

  const afterRevoke = await bearerApi.get("/api/v1/accounts").send();
  assert.equal(afterRevoke.status, 401);
});

test("x-user-id bypass is disabled when AUTH_ALLOW_DEV_BYPASS is false", async () => {
  const { rawApi } = createHarness({ allowDevBypass: false });
  const res = await rawApi.get("/api/v1/settings").set("x-user-id", "1").send();
  assert.equal(res.status, 401);
});
