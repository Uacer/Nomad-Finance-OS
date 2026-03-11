const state = {
  month: "",
  userId: 1,
  accounts: [],
  categories: {},
  settings: null,
  providers: [],
  dashboard: null,
  risk: null,
  txTagFilter: "",
  latestExtractionId: null,
  latestExtractionDraft: null
};

const $ = (selector) => document.querySelector(selector);

document.addEventListener("DOMContentLoaded", () => {
  state.month = new Date().toISOString().slice(0, 7);
  $("#monthInput").value = state.month;
  bindUI();
  loadAll();
});

function bindUI() {
  $("#reloadBtn").addEventListener("click", async () => {
    syncControlState();
    await loadAll();
  });
  $("#applyTxFilterBtn").addEventListener("click", async () => {
    state.txTagFilter = $("#transactionTagFilter").value.trim();
    await loadTransactions();
  });
  for (const tab of document.querySelectorAll(".tab")) {
    tab.addEventListener("click", () => switchPanel(tab.dataset.panel));
  }
  $("#accountForm").addEventListener("submit", submitAccountForm);
  $("#transactionForm").addEventListener("submit", submitTransactionForm);
  $("#budgetForm").addEventListener("submit", submitBudgetForm);
  $("#yearlyBudgetForm").addEventListener("submit", submitYearlyBudgetForm);
  $("#l1Form").addEventListener("submit", submitL1Form);
  $("#l2Form").addEventListener("submit", submitL2Form);
  $("#settingsForm").addEventListener("submit", submitSettingsForm);
  $("#providerForm").addEventListener("submit", submitProviderForm);
  $("#captureTextForm").addEventListener("submit", submitCaptureTextForm);
  $("#captureImageForm").addEventListener("submit", submitCaptureImageForm);
  $("#confirmExtractionBtn").addEventListener("click", confirmLatestExtraction);
  $("#generateReviewBtn").addEventListener("click", generateMonthlyReview);
  $("#transactionForm [name=type]").addEventListener("change", handleTxTypeChange);
  $("#transactionForm [name=category_l1]").addEventListener("change", populateL2Select);

  const txDate = $("#transactionForm [name=date]");
  txDate.value = new Date().toISOString().slice(0, 10);
  $("#yearlyBudgetForm [name=year]").value = new Date().getFullYear();
  handleTxTypeChange();

  $("#providerList").addEventListener("click", async (event) => {
    if (!(event.target instanceof Element)) return;
    const btn = event.target.closest("button[data-action]");
    if (!btn) return;
    const id = Number(btn.dataset.id);
    if (!Number.isInteger(id)) return;
    const action = btn.dataset.action;
    try {
      if (action === "set-default") {
        await api(`/api/v1/ai/providers/${id}/set-default`, { method: "POST", body: "{}" });
        showToast("Default provider updated");
      } else if (action === "validate") {
        const result = await api(`/api/v1/ai/providers/${id}/validate`, {
          method: "POST",
          body: "{}"
        });
        showToast(result.ok ? "Provider validated" : "Provider validation failed", !result.ok);
      } else if (action === "delete") {
        await api(`/api/v1/ai/providers/${id}`, { method: "DELETE" });
        showToast("Provider removed");
      }
      await loadProviders();
    } catch (error) {
      showToast(error.message, true);
    }
  });
}

function switchPanel(id) {
  for (const tab of document.querySelectorAll(".tab")) {
    tab.classList.toggle("active", tab.dataset.panel === id);
  }
  for (const panel of document.querySelectorAll(".panel")) {
    panel.classList.toggle("active", panel.id === id);
  }
}

function syncControlState() {
  const uid = Number($("#userIdInput").value || "1");
  state.userId = Number.isInteger(uid) && uid > 0 ? uid : 1;
  state.month = $("#monthInput").value || new Date().toISOString().slice(0, 7);
}

async function api(path, init = {}) {
  const headers = {
    "x-user-id": String(state.userId),
    ...(init.headers || {})
  };
  if (!headers["content-type"] && init.body !== undefined) {
    headers["content-type"] = "application/json";
  }
  const res = await fetch(path, { ...init, headers });
  if (!res.ok) {
    const payload = await safeJson(res);
    const detail =
      typeof payload?.error === "string"
        ? payload.error
        : payload?.error
          ? JSON.stringify(payload.error)
          : `${res.status} ${res.statusText}`;
    throw new Error(detail);
  }
  return safeJson(res);
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

function formatMoney(value) {
  return Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function showToast(message, isError = false) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.remove("hidden");
  toast.style.background = isError ? "#3a1420" : "#13202f";
  toast.style.borderColor = isError ? "#7a2d41" : "#2b3f5e";
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => toast.classList.add("hidden"), 2400);
}

async function loadAll() {
  try {
    syncControlState();
    await Promise.all([loadSettings(), loadCategories(), loadAccounts(), loadProviders()]);
    await Promise.all([
      loadDashboard(),
      loadTransactions(),
      loadBudgets(),
      loadYearlyBudgets(),
      loadReview(),
      loadRisk()
    ]);
    showToast(`Loaded user ${state.userId}`);
  } catch (error) {
    showToast(error.message, true);
  }
}

async function loadSettings() {
  state.settings = (await api("/api/v1/settings")) || {
    base_currency: "USD",
    timezone: "UTC",
    default_ai_provider_id: null
  };
  $("#settingsForm [name=base_currency]").value = state.settings.base_currency || "USD";
  $("#settingsForm [name=timezone]").value = state.settings.timezone || "UTC";
}

async function loadCategories() {
  state.categories = (await api("/api/v1/categories")) || {};
  renderCategoryTree();
  populateL1Selects();
}

async function loadAccounts() {
  state.accounts = (await api("/api/v1/accounts")) || [];
  renderAccounts();
  populateAccountSelects();
}

async function loadProviders() {
  state.providers = (await api("/api/v1/ai/providers")) || [];
  renderProviders();
}

function populateL1Selects() {
  const activeL1 = Object.entries(state.categories || {})
    .filter(([, cfg]) => cfg.active)
    .map(([name]) => name);
  const selects = [
    $("#transactionForm [name=category_l1]"),
    $("#budgetForm [name=category_l1]"),
    $("#yearlyBudgetForm [name=category_l1]"),
    $("#l2Form [name=l1_name]")
  ];
  for (const select of selects) {
    select.innerHTML = "";
    for (const name of activeL1) {
      select.appendChild(new Option(name, name));
    }
  }
  populateL2Select();
}

function populateL2Select() {
  const l1 = $("#transactionForm [name=category_l1]").value;
  const target = $("#transactionForm [name=category_l2]");
  target.innerHTML = "";
  const rows = state.categories?.[l1]?.l2 || [];
  for (const row of rows) {
    if (!row.active) continue;
    target.appendChild(new Option(row.name, row.name));
  }
}

function populateAccountSelects() {
  const from = $("#transactionForm [name=account_from_id]");
  const to = $("#transactionForm [name=account_to_id]");
  for (const select of [from, to]) {
    select.innerHTML = '<option value="">-- none --</option>';
    for (const account of state.accounts || []) {
      const label = `${account.name} · ${account.type} · ${formatMoney(account.balance)} ${account.currency}`;
      select.appendChild(new Option(label, String(account.id)));
    }
  }
}

function handleTxTypeChange() {
  const type = $("#transactionForm [name=type]").value;
  for (const el of document.querySelectorAll(".field-expense")) {
    el.classList.toggle("hidden", type !== "expense");
  }
  for (const el of document.querySelectorAll(".field-transfer")) {
    el.classList.toggle("hidden", type !== "transfer");
  }
  const fromLabel = $("#transactionForm [name=account_from_id]").closest("label");
  const toLabel = $("#transactionForm [name=account_to_id]").closest("label");
  if (type === "income") {
    fromLabel.classList.add("hidden");
    toLabel.classList.remove("hidden");
  } else if (type === "expense") {
    fromLabel.classList.remove("hidden");
    toLabel.classList.add("hidden");
  } else {
    fromLabel.classList.remove("hidden");
    toLabel.classList.remove("hidden");
  }
}

async function submitAccountForm(event) {
  event.preventDefault();
  const fd = new FormData(event.currentTarget);
  try {
    await api("/api/v1/accounts", {
      method: "POST",
      body: JSON.stringify({
        name: fd.get("name"),
        type: fd.get("type"),
        currency: String(fd.get("currency")).toUpperCase(),
        balance: Number(fd.get("balance") || "0")
      })
    });
    event.currentTarget.reset();
    $("#accountForm [name=currency]").value = "USD";
    showToast("Account created");
    await Promise.all([loadAccounts(), loadDashboard()]);
  } catch (error) {
    showToast(error.message, true);
  }
}

async function submitTransactionForm(event) {
  event.preventDefault();
  const fd = new FormData(event.currentTarget);
  const type = fd.get("type");
  const fxRaw = String(fd.get("fx_rate") || "").trim();
  const payload = {
    date: fd.get("date"),
    type,
    amount_original: Number(fd.get("amount_original")),
    currency_original: String(fd.get("currency_original")).toUpperCase(),
    note: fd.get("note") || "",
    tags: String(fd.get("tags") || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
  };
  if (fxRaw) payload.fx_rate = Number(fxRaw);

  if (type === "expense") {
    payload.category_l1 = fd.get("category_l1");
    payload.category_l2 = fd.get("category_l2");
    payload.account_from_id = parseOptionalInt(fd.get("account_from_id"));
  } else if (type === "income") {
    payload.account_to_id = parseOptionalInt(fd.get("account_to_id"));
  } else {
    payload.account_from_id = parseOptionalInt(fd.get("account_from_id"));
    payload.account_to_id = parseOptionalInt(fd.get("account_to_id"));
    payload.transfer_reason = fd.get("transfer_reason");
  }

  try {
    await api("/api/v1/transactions", { method: "POST", body: JSON.stringify(payload) });
    showToast("Transaction created");
    $("#transactionForm [name=amount_original]").value = "";
    $("#transactionForm [name=note]").value = "";
    $("#transactionForm [name=tags]").value = "";
    await refreshAfterLedgerChange();
  } catch (error) {
    showToast(error.message, true);
  }
}

async function submitBudgetForm(event) {
  event.preventDefault();
  const fd = new FormData(event.currentTarget);
  try {
    await api("/api/v1/budgets", {
      method: "POST",
      body: JSON.stringify({
        month: fd.get("month"),
        category_l1: fd.get("category_l1"),
        total_amount: Number(fd.get("total_amount"))
      })
    });
    showToast("Monthly budget saved");
    await Promise.all([loadBudgets(), loadDashboard()]);
  } catch (error) {
    showToast(error.message, true);
  }
}

async function submitYearlyBudgetForm(event) {
  event.preventDefault();
  const fd = new FormData(event.currentTarget);
  try {
    await api("/api/v1/budgets/yearly", {
      method: "POST",
      body: JSON.stringify({
        year: Number(fd.get("year")),
        category_l1: fd.get("category_l1"),
        total_amount: Number(fd.get("total_amount"))
      })
    });
    showToast("Yearly budget saved");
    await loadYearlyBudgets();
  } catch (error) {
    showToast(error.message, true);
  }
}

async function submitL1Form(event) {
  event.preventDefault();
  const fd = new FormData(event.currentTarget);
  try {
    await api("/api/v1/categories/l1", {
      method: "POST",
      body: JSON.stringify({ name: fd.get("name") })
    });
    event.currentTarget.reset();
    showToast("L1 category created");
    await loadCategories();
  } catch (error) {
    showToast(error.message, true);
  }
}

async function submitL2Form(event) {
  event.preventDefault();
  const fd = new FormData(event.currentTarget);
  try {
    await api("/api/v1/categories/l2", {
      method: "POST",
      body: JSON.stringify({
        l1_name: fd.get("l1_name"),
        name: fd.get("name")
      })
    });
    event.currentTarget.reset();
    showToast("L2 category created");
    await loadCategories();
  } catch (error) {
    showToast(error.message, true);
  }
}

async function submitSettingsForm(event) {
  event.preventDefault();
  const fd = new FormData(event.currentTarget);
  try {
    await api("/api/v1/settings", {
      method: "PUT",
      body: JSON.stringify({
        base_currency: String(fd.get("base_currency")).toUpperCase(),
        timezone: fd.get("timezone")
      })
    });
    showToast("Settings updated");
    await Promise.all([loadSettings(), loadDashboard()]);
  } catch (error) {
    showToast(error.message, true);
  }
}

async function submitProviderForm(event) {
  event.preventDefault();
  const fd = new FormData(event.currentTarget);
  try {
    await api("/api/v1/ai/providers", {
      method: "POST",
      body: JSON.stringify({
        provider_type: "openai_compatible",
        display_name: fd.get("display_name"),
        base_url: fd.get("base_url"),
        model: fd.get("model"),
        api_key: fd.get("api_key")
      })
    });
    event.currentTarget.reset();
    showToast("Provider created");
    await loadProviders();
  } catch (error) {
    showToast(error.message, true);
  }
}

async function submitCaptureTextForm(event) {
  event.preventDefault();
  const fd = new FormData(event.currentTarget);
  try {
    const payload = await api("/api/v1/transactions/parse-text", {
      method: "POST",
      body: JSON.stringify({ text: fd.get("text") })
    });
    setLatestExtraction(payload);
    showToast("Parsed with provider");
  } catch (error) {
    showToast(error.message, true);
  }
}

async function submitCaptureImageForm(event) {
  event.preventDefault();
  const fd = new FormData(event.currentTarget);
  try {
    const payload = await api("/api/v1/transactions/parse-image", {
      method: "POST",
      body: JSON.stringify({
        ocr_text: fd.get("ocr_text"),
        image_base64: fd.get("image_base64")
      })
    });
    setLatestExtraction(payload);
    showToast("OCR parsed with provider");
  } catch (error) {
    showToast(error.message, true);
  }
}

function setLatestExtraction(payload) {
  state.latestExtractionId = payload.extraction_id;
  state.latestExtractionDraft = payload.draft;
  $("#extractionPreview").textContent = JSON.stringify(payload, null, 2);
}

async function confirmLatestExtraction() {
  if (!state.latestExtractionId) {
    showToast("No extraction to confirm", true);
    return;
  }
  try {
    await api("/api/v1/transactions/confirm-extraction", {
      method: "POST",
      body: JSON.stringify({
        extraction_id: state.latestExtractionId,
        overrides: state.latestExtractionDraft || {}
      })
    });
    showToast("Extraction confirmed");
    state.latestExtractionId = null;
    state.latestExtractionDraft = null;
    $("#extractionPreview").textContent = "";
    await refreshAfterLedgerChange();
  } catch (error) {
    showToast(error.message, true);
  }
}

async function generateMonthlyReview() {
  try {
    await api("/api/v1/reviews/monthly/generate", {
      method: "POST",
      body: JSON.stringify({ month: state.month })
    });
    showToast("Monthly review snapshot generated");
    await loadReview();
  } catch (error) {
    showToast(error.message, true);
  }
}

async function loadDashboard() {
  const dashboard = await api(`/api/v1/dashboard?month=${state.month}`);
  state.dashboard = dashboard;
  const baseCurrency = dashboard.base_currency || state.settings?.base_currency || "USD";
  const pairs = [
    [`Net Worth (${baseCurrency})`, dashboard.net_worth],
    [`Liquid Cash (${baseCurrency})`, dashboard.liquid_cash],
    [`Restricted Cash (${baseCurrency})`, dashboard.restricted_cash_total],
    [`Monthly Income (${baseCurrency})`, dashboard.monthly_income],
    [`Monthly Expense (${baseCurrency})`, dashboard.monthly_expense],
    [`Net Cash Flow (${baseCurrency})`, dashboard.net_cash_flow],
    [`Burn Rate (${baseCurrency})`, dashboard.burn_rate],
    ["Runway (months)", dashboard.runway_months ?? "Infinity"]
  ];
  $("#metricsGrid").innerHTML = pairs
    .map(
      ([label, value]) => `
      <article class="metric">
        <div class="label">${label}</div>
        <div class="value">${typeof value === "number" ? formatMoney(value) : value}</div>
      </article>`
    )
    .join("");
  renderInfographics(dashboard);
  renderBudgetStatus(dashboard.budget_status || []);
}

async function loadRisk() {
  const risk = (await api(`/api/v1/metrics/risk?month=${state.month}`)) || {
    crypto_exposure: 0,
    income_volatility: 0,
    fixed_cost_ratio: 0
  };
  state.risk = risk;
  $("#riskMetrics").innerHTML = `
    <article class="list-row"><div class="row-main"><strong>Crypto Exposure</strong><span>${
      (risk.crypto_exposure * 100).toFixed(2)
    }%</span></div></article>
    <article class="list-row"><div class="row-main"><strong>Income Volatility</strong><span>${
      (risk.income_volatility * 100).toFixed(2)
    }%</span></div></article>
    <article class="list-row"><div class="row-main"><strong>Fixed Cost Ratio</strong><span>${
      (risk.fixed_cost_ratio * 100).toFixed(2)
    }%</span></div></article>
  `;
}

function renderInfographics(dashboard) {
  renderCashFlowBars(dashboard);
  renderLiquiditySplit(dashboard);
  renderRunwaySignal(dashboard);
}

function renderCashFlowBars(dashboard) {
  const target = $("#cashFlowBars");
  if (!target) return;
  const base = dashboard.base_currency || state.settings?.base_currency || "USD";
  const rows = [
    { label: "Income", value: Number(dashboard.monthly_income || 0), tone: "income" },
    { label: "Expense", value: Number(dashboard.monthly_expense || 0), tone: "expense" },
    { label: "Burn", value: Number(dashboard.burn_rate || 0), tone: "burn" },
    {
      label: "Net",
      value: Number(dashboard.net_cash_flow || 0),
      tone: Number(dashboard.net_cash_flow || 0) >= 0 ? "net" : "expense"
    }
  ];
  const maxAbs = Math.max(1, ...rows.map((row) => Math.abs(row.value)));
  target.innerHTML = rows
    .map((row) => {
      const width = Math.max(2, (Math.abs(row.value) / maxAbs) * 100);
      return `
        <div class="mini-bar-row">
          <span class="mini-bar-label">${row.label}</span>
          <div class="mini-bar-track"><div class="mini-bar-fill ${row.tone}" style="width:${width}%"></div></div>
          <span class="mini-bar-value">${formatSignedMoney(row.value)} ${base}</span>
        </div>
      `;
    })
    .join("");
}

function renderLiquiditySplit(dashboard) {
  const ring = $("#liquidityRing");
  const legend = $("#liquidityLegend");
  if (!ring || !legend) return;
  const base = dashboard.base_currency || state.settings?.base_currency || "USD";
  const liquid = Math.max(0, Number(dashboard.liquid_cash || 0));
  const restricted = Math.max(0, Number(dashboard.restricted_cash_total || 0));
  const total = liquid + restricted;
  const liquidPct = total > 0 ? (liquid / total) * 100 : 0;
  const deg = Math.max(0, Math.min(360, liquidPct * 3.6));
  ring.style.background = `conic-gradient(#4de2b7 0deg, #4de2b7 ${deg}deg, #6aa7ff ${deg}deg, #6aa7ff 360deg)`;
  ring.innerHTML = `<span class="ring-center">${liquidPct.toFixed(0)}% liquid</span>`;
  legend.innerHTML = `
    <div class="compact-row"><span><span class="dot liquid"></span>Liquid</span><strong>${formatMoney(liquid)} ${base}</strong></div>
    <div class="compact-row"><span><span class="dot restricted"></span>Restricted</span><strong>${formatMoney(restricted)} ${base}</strong></div>
    <div class="compact-row"><span>Total</span><strong>${formatMoney(total)} ${base}</strong></div>
  `;
}

function renderRunwaySignal(dashboard) {
  const target = $("#runwayGauge");
  if (!target) return;
  const raw = dashboard.runway_months;
  const runway = typeof raw === "number" ? raw : Number(raw);
  const finite = Number.isFinite(runway);
  const cap = 24;
  const pct = finite ? Math.max(0, Math.min(100, (runway / cap) * 100)) : 100;
  const fillColor = !finite
    ? "linear-gradient(90deg, #4de2b7, #89ffde)"
    : runway < 6
      ? "linear-gradient(90deg, #ff5d7a, #ff8b9e)"
      : runway < 12
        ? "linear-gradient(90deg, #f8c36e, #ffd99a)"
        : "linear-gradient(90deg, #4de2b7, #89ffde)";
  target.innerHTML = `
    <div class="runway-track"><div class="runway-fill" style="width:${pct}%;background:${fillColor};"></div></div>
    <div class="runway-meta">
      <span>${finite ? `${runway.toFixed(1)} months` : "Infinity"}</span>
      <span>Scale: 0-${cap}m</span>
    </div>
  `;
}

function renderBudgetStatus(rows) {
  const target = $("#budgetStatusList");
  if (!rows.length) {
    target.innerHTML = '<div class="list-row muted">No budget configured for this month.</div>';
    return;
  }
  target.innerHTML = rows
    .map((row) => {
      const total = Number(row.total_amount || 0);
      const spent = Number(row.spent_amount || 0);
      const pct = total > 0 ? Math.min((spent / total) * 100, 100) : 0;
      return `
        <article class="list-row">
          <div class="row-main">
            <strong>${escapeHtml(row.category_l1)}</strong>
            <span class="${row.overspend ? "overspend" : "muted"}">${formatMoney(spent)} / ${formatMoney(total)}</span>
          </div>
          <div class="progress-wrap"><div class="progress-fill" style="width:${pct}%"></div></div>
        </article>`;
    })
    .join("");
}

function renderAccounts() {
  const target = $("#accountList");
  if (!state.accounts.length) {
    target.innerHTML = '<div class="list-row muted">No accounts yet.</div>';
    return;
  }
  target.innerHTML = state.accounts
    .map(
      (row) => `
      <article class="list-row">
        <div class="row-main">
          <strong>${escapeHtml(row.name)}</strong>
          <span class="mono">${formatMoney(row.balance)} ${row.currency}</span>
        </div>
        <div class="muted">type: ${row.type}</div>
      </article>`
    )
    .join("");
}

function renderProviders() {
  const target = $("#providerList");
  const providers = Array.isArray(state.providers) ? state.providers.filter(Boolean) : [];
  if (!providers.length) {
    target.innerHTML =
      '<div class="list-row muted">No provider configured. Capture parser is unavailable until provider is set.</div>';
    return;
  }
  target.innerHTML = providers
    .map(
      (row) => `
      <article class="list-row">
        <div class="row-main">
          <strong>${escapeHtml(row.display_name)}</strong>
          <span class="pill">${escapeHtml(row.model)}</span>
        </div>
        <div class="muted">${escapeHtml(row.base_url)} · key ${row.key_masked}</div>
        <div class="row-main">
          <span class="${row.is_default ? "" : "muted"}">${row.is_default ? "default provider" : "non-default"}</span>
          <div class="tag-wrap">
            <button class="btn" data-action="set-default" data-id="${row.id}">Set Default</button>
            <button class="btn" data-action="validate" data-id="${row.id}">Validate</button>
            <button class="btn" data-action="delete" data-id="${row.id}">Delete</button>
          </div>
        </div>
      </article>`
    )
    .join("");
}

async function loadTransactions() {
  let path = `/api/v1/transactions?month=${state.month}`;
  if (state.txTagFilter) {
    path += `&tag=${encodeURIComponent(state.txTagFilter)}`;
  }
  const rows = await api(path);
  const target = $("#transactionList");
  if (!rows.length) {
    target.innerHTML = '<div class="list-row muted">No transactions for this month.</div>';
    return;
  }
  target.innerHTML = rows
    .map((row) => {
      const tags =
        row.tags && row.tags.length
          ? `<div class="tag-wrap">${row.tags
              .map((tag) => `<span class="pill">${escapeHtml(tag)}</span>`)
              .join("")}</div>`
          : "";
      return `
        <article class="list-row">
          <div class="row-main">
            <strong>${row.type.toUpperCase()} · ${formatMoney(row.amount_base)} ${
        state.settings?.base_currency || "USD"
      }</strong>
            <span class="muted">${row.tx_date}</span>
          </div>
          <div class="muted">original: ${formatMoney(row.amount_original)} ${escapeHtml(
        row.currency_original
      )}</div>
          <div class="muted">${row.category_l1 || "-"} / ${row.category_l2 || "-"} · reason: ${
        row.transfer_reason || "-"
      }</div>
          <div class="muted mono">from: ${row.account_from_id || "-"} · to: ${row.account_to_id || "-"}</div>
          <div>${escapeHtml(row.note || "")}</div>
          ${tags}
        </article>`;
    })
    .join("");
}

async function loadBudgets() {
  const rows = await api(`/api/v1/budgets?month=${state.month}`);
  $("#budgetForm [name=month]").value = state.month;
  const target = $("#budgetList");
  if (!rows.length) {
    target.innerHTML = '<div class="list-row muted">No monthly budgets.</div>';
    return;
  }
  target.innerHTML = rows
    .map(
      (row) => `
      <article class="list-row">
        <div class="row-main">
          <strong>${escapeHtml(row.category_l1)}</strong>
          <span class="${row.overspend ? "overspend" : "muted"}">${formatMoney(row.spent_amount)} / ${formatMoney(row.total_amount)}</span>
        </div>
        <div class="muted">Remaining: ${formatMoney(row.remaining_amount)}</div>
      </article>`
    )
    .join("");
}

async function loadYearlyBudgets() {
  const year = Number(state.month.slice(0, 4));
  const rows = await api(`/api/v1/budgets/yearly?year=${year}`);
  const target = $("#yearlyBudgetList");
  if (!rows.length) {
    target.innerHTML = '<div class="list-row muted">No yearly budgets.</div>';
    return;
  }
  target.innerHTML = rows
    .map(
      (row) => `
      <article class="list-row">
        <div class="row-main">
          <strong>${escapeHtml(row.category_l1)}</strong>
          <span class="${row.overspend ? "overspend" : "muted"}">${formatMoney(row.spent_amount)} / ${formatMoney(row.total_amount)}</span>
        </div>
        <div class="muted">Remaining: ${formatMoney(row.remaining_amount)}</div>
      </article>`
    )
    .join("");
}

async function loadReview() {
  const review = await api(`/api/v1/reviews/monthly?month=${state.month}`);
  $("#reviewSummary").textContent = review.summary || "";
  $("#reviewL1").innerHTML = (review.expense_structure_l1 || [])
    .map(
      (row) => `
      <div class="list-row">
        <div class="row-main">
          <strong>${escapeHtml(row.category_l1)}</strong>
          <span>${formatMoney(row.total)}</span>
        </div>
      </div>`
    )
    .join("");
  $("#reviewTop").innerHTML = (review.top_expenses || [])
    .map(
      (row) => `
      <div class="list-row">
        <div class="row-main">
          <strong>${escapeHtml(row.category_l1 || "")} / ${escapeHtml(row.category_l2 || "")}</strong>
          <span>${formatMoney(row.amount_base)}</span>
        </div>
        <div class="muted">${row.tx_date}</div>
        <div>${escapeHtml(row.note || "")}</div>
      </div>`
    )
    .join("");
}

function renderCategoryTree() {
  const rows = Object.entries(state.categories || {}).filter(([, cfg]) => Boolean(cfg));
  const target = $("#categoryTree");
  if (!rows.length) {
    target.innerHTML = '<div class="list-row muted">No categories.</div>';
    return;
  }
  target.innerHTML = rows
    .map(([name, cfg]) => {
      const l2 = (cfg.l2 || [])
        .map((item) => `<span class="pill">${escapeHtml(item.name)}</span>`)
        .join("");
      return `
        <article class="list-row">
          <div class="row-main">
            <strong>${escapeHtml(name)}</strong>
            <span class="muted">${cfg.active ? "active" : "inactive"}</span>
          </div>
          <div class="tag-wrap">${l2 || '<span class="muted">No L2 categories</span>'}</div>
        </article>`;
    })
    .join("");
}

async function refreshAfterLedgerChange() {
  await Promise.all([
    loadAccounts(),
    loadDashboard(),
    loadTransactions(),
    loadBudgets(),
    loadYearlyBudgets(),
    loadReview(),
    loadRisk()
  ]);
}

function escapeHtml(input) {
  return String(input)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function parseOptionalInt(value) {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : undefined;
}

function formatSignedMoney(value) {
  const num = Number(value || 0);
  const sign = num > 0 ? "+" : num < 0 ? "-" : "";
  return `${sign}${formatMoney(Math.abs(num))}`;
}
