const state = {
  month: "",
  userId: 1,
  accounts: [],
  categories: {},
  settings: null,
  providers: [],
  dashboard: null,
  risk: null,
  utilityReturnSheet: "",
  editingAccountId: null,
  quickEntryMax: 0,
  quickEntryType: "expense",
  txTagFilter: "",
  latestExtractionId: null,
  latestExtractionDraft: null,
  trend: {
    start: "",
    end: "",
    mode: "expense",
    points: []
  },
  ui: {
    showCashFlow: false,
    showTrend: false,
    showRisk: false,
    showDebug: false
  },
  debug: {
    requests: [],
    runtimeErrors: [],
    onlyFailed: false,
    filter: "",
    maxEntries: 100
  }
};

const UI_CURRENCIES = new Set(["CNY", "EUR", "THB", "USD", "JPY", "KRW"]);
const UI_LANGUAGES = new Set(["en", "zh"]);
const CATEGORY_L1_EMOJI = {
  Living: "🏠",
  Travel: "✈️",
  Work: "💼",
  Investment: "📈",
  Lifestyle: "✨",
  Study: "📚"
};
const CATEGORY_L2_EMOJI = {
  Rent: "🏡",
  Utilities: "💡",
  Groceries: "🛒",
  Healthcare: "🩺",
  Flights: "🛫",
  Hotels: "🏨",
  Visa: "🛂",
  "Local Transport": "🛵",
  SaaS: "🧰",
  Coworking: "🏢",
  Equipment: "🖥️",
  Contractor: "🧑‍💻",
  "Broker Fees": "💹",
  "On-chain Fees": "⛓️",
  Custody: "🔐",
  Dining: "🍽️",
  Entertainment: "🎬",
  Shopping: "🛍️",
  Fitness: "🏋️",
  Courses: "🎓",
  Books: "📖",
  Certification: "📜",
  Workshops: "🧪"
};

const I18N = {
  en: {
    subtitle: "A simpler daily money cockpit.",
    month: "Month",
    dashboard: "🏠 Dashboard",
    cashFlowPulse: "📈 Cash Flow Pulse",
    liquiditySplit: "Liquidity Split",
    runwaySignal: "Runway Signal",
    riskMetrics: "⚠️ Risk Metrics",
    budgetStatus: "Budget Status (L1 only)",
    netWorthComposition: "🧩 Net Worth Composition",
    plannedBudget: "📋 Planned Budget",
    budgetPlanSummary: "Planned {planned} · Spent {spent} · Remaining {remaining}",
    periodMonthly: "month",
    periodYearly: "yearly",
    editBudget: "Edit Budget",
    addExpense: "🧾 Add Expense",
    addIncome: "💰 Add Income",
    addTransfer: "🔁 Add Transfer",
    close: "Close",
    date: "Date",
    stepL1Title: "Step 1 · 🗂️ Choose Category L1",
    stepL2Title: "Step 2 · 🏷️ Choose Category L2",
    stepSpendTitle: "Step 3 · 💳 Account & Currency",
    stepAmountTitle: "Step 4 · 🎛️ Enter Amount",
    categoryL1: "Category L1",
    categoryL2: "Category L2",
    account: "Account",
    accountType: "Account Type",
    accountTo: "Account To",
    currency: "Currency",
    amount: "Amount",
    amountWheel: "Amount Wheel",
    note: "Note",
    saveExpense: "Save Expense",
    saveIncome: "Save Income",
    saveTransfer: "Save Transfer",
    budgetEditor: "Budget Editor",
    totalAmount: "Total Amount",
    saveBudget: "Save Budget",
    settings: "⚙️ Settings",
    userId: "User ID",
    language: "Language",
    baseCurrency: "Base Currency",
    timezone: "Timezone",
    saveSettings: "Save Settings",
    advancedInsights: "Advanced Insights",
    showCashFlow: "Cash Flow Pulse",
    showTrend: "Spending Curve",
    showRisk: "Risk Metrics",
    showDebug: "Debug Panel",
    debugPanel: "Debug Panel",
    debugOnlyFailed: "Only Failed",
    debugFilter: "Filter",
    debugFilterPlaceholder: "accounts, dashboard, 500",
    debugCopy: "Copy Diagnostics",
    debugClear: "Clear",
    debugRequests: "Requests",
    debugRuntime: "Runtime Errors",
    debugNoRequests: "No request diagnostics yet.",
    debugNoRuntime: "No runtime errors captured.",
    debugCopyDone: "Diagnostics copied",
    debugCopyFailed: "Copy failed",
    refreshFailedAfterSave: "Saved, but refresh failed.",
    trendTitle: "📉 Spending Curve",
    trendModeExpense: "Daily Expense",
    trendModeNetWorth: "Net Worth Change",
    trendFrom: "From",
    trendTo: "To",
    selectAccount: "Select account",
    advancedBudget: "🧠 Advanced Budget",
    accounts: "🏦 Accounts",
    monthlyReview: "🗓️ Monthly Review",
    categories: "🧩 Categories",
    aiProviders: "🤖 AI Providers",
    backToDashboard: "Back to Dashboard",
    back: "Back",
    edit: "Edit",
    editAccount: "Edit Account",
    saveAccount: "Save Account",
    deleteAccount: "Delete Account",
    forceDeleteAccount: "Force Delete (with Transactions)",
    accountDeleteConfirm: "Delete this account? This cannot be undone.",
    accountForceDeleteConfirm:
      "Force delete this account and all linked transactions ({count})? This cannot be undone.",
    accountUpdated: "Account updated",
    accountDeleted: "Account deleted",
    accountForceDeleted: "Account and linked transactions deleted",
    metricNetWorth: "Net Worth",
    metricLiquidCash: "Liquid Cash",
    metricRestrictedCash: "Restricted Cash",
    metricMonthlyIncome: "Monthly Income",
    metricMonthlyExpense: "Monthly Expense",
    metricNetCashFlow: "Net Cash Flow",
    metricBurnRate: "Burn Rate",
    metricRunwayMonths: "Runway (months)",
    riskCryptoExposure: "Crypto Exposure",
    riskIncomeVolatility: "Income Volatility",
    riskFixedCostRatio: "Fixed Cost Ratio",
    labelIncome: "Income",
    labelExpense: "Expense",
    labelBurn: "Burn",
    labelNet: "Net",
    labelLiquid: "Liquid",
    labelRestricted: "Restricted",
    labelTotal: "Total",
    labelScale: "Scale",
    emptyNoBudgetMonth: "No budget configured for this month.",
    emptyNoTxMonth: "No transactions for this month.",
    emptyNoMonthlyBudget: "No monthly budgets.",
    emptyNoYearlyBudget: "No yearly budgets.",
    emptyNoQuickBudget: "No budgets yet.",
    remaining: "Remaining",
    original: "original",
    reason: "reason",
    from: "from",
    to: "to",
    loadedUser: "Loaded user {id}",
    settingsUpdated: "Settings updated",
    budgetUpdated: "Budget updated",
    expenseSaved: "Expense saved",
    maxSpendHint: "max: {amount} {currency}",
    amountExceeded: "Amount exceeds account available balance ({amount} {currency}).",
    invalidAmount: "Please enter a valid amount.",
    txTypeExpense: "EXPENSE",
    txTypeIncome: "INCOME",
    txTypeTransfer: "TRANSFER"
  },
  zh: {
    subtitle: "更轻量的日常财务驾驶舱。",
    month: "月份",
    dashboard: "🏠 总览",
    cashFlowPulse: "📈 现金流脉冲",
    liquiditySplit: "流动性结构",
    runwaySignal: "Runway 信号",
    riskMetrics: "⚠️ 风险指标",
    budgetStatus: "预算进度（仅一级分类）",
    netWorthComposition: "🧩 净资产结构",
    plannedBudget: "📋 预算计划",
    budgetPlanSummary: "计划 {planned} · 已花 {spent} · 剩余 {remaining}",
    periodMonthly: "月",
    periodYearly: "每年",
    editBudget: "编辑预算",
    addExpense: "🧾 新增支出",
    addIncome: "💰 新增收入",
    addTransfer: "🔁 新增转账",
    close: "关闭",
    date: "日期",
    stepL1Title: "第 1 步 · 🗂️ 选择一级分类",
    stepL2Title: "第 2 步 · 🏷️ 选择二级分类",
    stepSpendTitle: "第 3 步 · 💳 选择账户与币种",
    stepAmountTitle: "第 4 步 · 🎛️ 输入金额",
    categoryL1: "一级分类",
    categoryL2: "二级分类",
    account: "账户",
    accountType: "账户类型",
    accountTo: "入账账户",
    currency: "币种",
    amount: "金额",
    amountWheel: "金额滚轮",
    note: "备注",
    saveExpense: "保存支出",
    saveIncome: "保存收入",
    saveTransfer: "保存转账",
    budgetEditor: "预算编辑",
    totalAmount: "预算总额",
    saveBudget: "保存预算",
    settings: "⚙️ 设置",
    userId: "用户 ID",
    language: "语言",
    baseCurrency: "基准货币",
    timezone: "时区",
    saveSettings: "保存设置",
    advancedInsights: "高级洞察",
    showCashFlow: "现金流脉冲",
    showTrend: "支出曲线",
    showRisk: "风险指标",
    showDebug: "调试面板",
    debugPanel: "调试面板",
    debugOnlyFailed: "仅失败",
    debugFilter: "过滤",
    debugFilterPlaceholder: "accounts、dashboard、500",
    debugCopy: "复制诊断",
    debugClear: "清空",
    debugRequests: "请求记录",
    debugRuntime: "运行时错误",
    debugNoRequests: "暂无请求诊断记录。",
    debugNoRuntime: "暂无运行时错误。",
    debugCopyDone: "诊断信息已复制",
    debugCopyFailed: "复制失败",
    refreshFailedAfterSave: "保存成功，但刷新失败。",
    trendTitle: "📉 支出曲线",
    trendModeExpense: "每日支出",
    trendModeNetWorth: "净资产变化",
    trendFrom: "开始",
    trendTo: "结束",
    selectAccount: "选择账户",
    advancedBudget: "🧠 高级预算",
    accounts: "🏦 账户管理",
    monthlyReview: "🗓️ 月度回顾",
    categories: "🧩 分类管理",
    aiProviders: "🤖 AI 提供商",
    backToDashboard: "返回总览",
    back: "返回",
    edit: "编辑",
    editAccount: "编辑账户",
    saveAccount: "保存账户",
    deleteAccount: "删除账户",
    forceDeleteAccount: "强制删除（含关联交易）",
    accountDeleteConfirm: "确认删除该账户？删除后不可恢复。",
    accountForceDeleteConfirm: "强制删除该账户及其关联交易（{count}）？删除后不可恢复。",
    accountUpdated: "账户已更新",
    accountDeleted: "账户已删除",
    accountForceDeleted: "账户及关联交易已删除",
    metricNetWorth: "净资产",
    metricLiquidCash: "流动现金",
    metricRestrictedCash: "受限现金",
    metricMonthlyIncome: "月收入",
    metricMonthlyExpense: "月支出",
    metricNetCashFlow: "净现金流",
    metricBurnRate: "燃烧率",
    metricRunwayMonths: "可持续月数",
    riskCryptoExposure: "加密资产敞口",
    riskIncomeVolatility: "收入波动率",
    riskFixedCostRatio: "固定成本占比",
    labelIncome: "收入",
    labelExpense: "支出",
    labelBurn: "燃烧",
    labelNet: "净额",
    labelLiquid: "流动",
    labelRestricted: "受限",
    labelTotal: "合计",
    labelScale: "刻度",
    emptyNoBudgetMonth: "本月还没有预算。",
    emptyNoTxMonth: "本月暂无交易记录。",
    emptyNoMonthlyBudget: "暂无月度预算。",
    emptyNoYearlyBudget: "暂无年度预算。",
    emptyNoQuickBudget: "还没有预算数据。",
    remaining: "剩余",
    original: "原始",
    reason: "原因",
    from: "转出",
    to: "转入",
    loadedUser: "已加载用户 {id}",
    settingsUpdated: "设置已更新",
    budgetUpdated: "预算已更新",
    expenseSaved: "支出已保存",
    maxSpendHint: "上限：{amount} {currency}",
    amountExceeded: "金额超过账户可用余额（{amount} {currency}）。",
    invalidAmount: "请输入有效金额。",
    txTypeExpense: "支出",
    txTypeIncome: "收入",
    txTypeTransfer: "转账"
  }
};

const FX_QUOTE_CACHE = new Map();
let quickEntryLimitReqSeq = 0;

const $ = (selector) => document.querySelector(selector);

document.addEventListener("DOMContentLoaded", () => {
  state.month = new Date().toISOString().slice(0, 7);
  $("#monthInput").value = state.month;
  bindUI();
  initializeDebugCapture();
  initializeQuickEntryDefaults();
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
  $("#openQuickAddBtn").addEventListener("click", () => openSheet("quickEntrySheet"));
  $("#openSettingsBtn").addEventListener("click", () => openSheet("settingsSheet"));
  const budgetBtn = $("#openBudgetSheetBtn");
  if (budgetBtn) {
    budgetBtn.addEventListener("click", () => {
      const monthInput = $("#quickBudgetForm [name=month]");
      if (monthInput) monthInput.value = state.month;
      openSheet("budgetSheet");
    });
  }
  $("#quickEntryForm").addEventListener("submit", submitQuickEntryForm);
  const trendStart = $("#trendStart");
  const trendEnd = $("#trendEnd");
  const trendMode = $("#trendMode");
  if (trendStart) {
    trendStart.addEventListener("change", () => {
      state.trend.start = trendStart.value || state.trend.start;
      persistUiState();
      void loadTrendData();
    });
  }
  if (trendEnd) {
    trendEnd.addEventListener("change", () => {
      state.trend.end = trendEnd.value || state.trend.end;
      persistUiState();
      void loadTrendData();
    });
  }
  if (trendMode) {
    trendMode.addEventListener("change", () => {
      state.trend.mode = trendMode.value || "expense";
      persistUiState();
      renderTrendChart();
    });
  }
  const toggleCashFlow = $("#toggleCashFlow");
  if (toggleCashFlow) {
    toggleCashFlow.addEventListener("change", () => {
      state.ui.showCashFlow = toggleCashFlow.checked;
      persistUiState();
      applyAdvancedVisibility();
    });
  }
  const toggleTrend = $("#toggleTrend");
  if (toggleTrend) {
    toggleTrend.addEventListener("change", () => {
      state.ui.showTrend = toggleTrend.checked;
      persistUiState();
      applyAdvancedVisibility();
    });
  }
  const toggleRisk = $("#toggleRisk");
  if (toggleRisk) {
    toggleRisk.addEventListener("change", () => {
      state.ui.showRisk = toggleRisk.checked;
      persistUiState();
      applyAdvancedVisibility();
    });
  }
  const toggleDebug = $("#toggleDebug");
  if (toggleDebug) {
    toggleDebug.addEventListener("change", () => {
      state.ui.showDebug = toggleDebug.checked;
      persistUiState();
      applyAdvancedVisibility();
      renderDebugPanel();
    });
  }
  for (const btn of document.querySelectorAll("[data-quick-type]")) {
    btn.addEventListener("click", () => {
      const type = String(btn.getAttribute("data-quick-type") || "expense");
      setQuickEntryType(type);
    });
  }
  $("#quickEntryForm [name=category_l1]").addEventListener("change", () => {
    populateQuickEntryL2();
  });
  $("#quickEntryForm [name=category_l2]").addEventListener("change", () => {
    void updateQuickEntryFlow();
  });
  $("#quickEntryForm [name=account_from_id]").addEventListener("change", () => {
    void updateQuickEntryFlow();
  });
  $("#quickEntryForm [name=account_to_id]").addEventListener("change", () => {
    void updateQuickEntryFlow();
  });
  $("#quickEntryForm [name=currency_original]").addEventListener("change", () => {
    void updateQuickEntryFlow();
  });
  $("#quickBudgetForm").addEventListener("submit", submitQuickBudgetForm);
  $("#quickSettingsForm").addEventListener("submit", submitQuickSettingsForm);
  $("#accountEditForm").addEventListener("submit", submitAccountEditForm);
  $("#accountDeleteBtn").addEventListener("click", deleteCurrentAccount);
  $("#accountForceDeleteBtn").addEventListener("click", forceDeleteCurrentAccount);
  $("#accountList").addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const editBtn = event.target.closest("button[data-action='edit-account']");
    if (!editBtn) return;
    const id = Number(editBtn.getAttribute("data-id"));
    if (!Number.isInteger(id) || id <= 0) return;
    openAccountEditSheet(id);
  });
  const debugOnlyFailed = $("#debugOnlyFailed");
  if (debugOnlyFailed) {
    debugOnlyFailed.addEventListener("change", () => {
      state.debug.onlyFailed = debugOnlyFailed.checked;
      renderDebugPanel();
    });
  }
  const debugFilterInput = $("#debugFilterInput");
  if (debugFilterInput) {
    debugFilterInput.addEventListener("input", () => {
      state.debug.filter = debugFilterInput.value.trim();
      renderDebugPanel();
    });
  }
  const debugCopyBtn = $("#debugCopyBtn");
  if (debugCopyBtn) debugCopyBtn.addEventListener("click", copyDiagnosticsToClipboard);
  const debugClearBtn = $("#debugClearBtn");
  if (debugClearBtn) {
    debugClearBtn.addEventListener("click", () => {
      state.debug.requests = [];
      state.debug.runtimeErrors = [];
      renderDebugPanel();
    });
  }
  $("#closeUtilityBtn").addEventListener("click", () => {
    const returnSheet = state.utilityReturnSheet || "";
    closeUtilityPanel();
    if (returnSheet) {
      state.utilityReturnSheet = "";
      openSheet(returnSheet);
    }
  });
  for (const closer of document.querySelectorAll("[data-close-sheet]")) {
    closer.addEventListener("click", () => closeSheet(String(closer.getAttribute("data-close-sheet"))));
  }
  for (const btn of document.querySelectorAll("[data-open-panel]")) {
    btn.addEventListener("click", () => {
      const target = String(btn.getAttribute("data-open-panel") || "");
      if (!target) return;
      state.utilityReturnSheet = "settingsSheet";
      openUtilityPanel(target);
    });
  }
  setupQuickAmountWheel();

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
      showErrorToast(error);
    }
  });
}

function initializeDebugCapture() {
  window.addEventListener("error", (event) => {
    recordRuntimeError({
      source: "window.onerror",
      message: String(event.message || "Unknown runtime error"),
      stack: event.error?.stack || "",
      filename: event.filename || "",
      line: Number(event.lineno || 0),
      column: Number(event.colno || 0)
    });
  });
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const message =
      typeof reason?.message === "string"
        ? reason.message
        : typeof reason === "string"
          ? reason
          : "Unhandled promise rejection";
    recordRuntimeError({
      source: "unhandledrejection",
      message,
      stack: reason?.stack || "",
      filename: "",
      line: 0,
      column: 0
    });
  });
}

function initializeQuickEntryDefaults() {
  const today = new Date().toISOString().slice(0, 10);
  const dateInput = $("#quickEntryForm [name=date]");
  if (dateInput) dateInput.value = today;
  const budgetMonth = $("#quickBudgetForm [name=month]");
  if (budgetMonth) budgetMonth.value = state.month;
}

function switchPanel(id) {
  for (const tab of document.querySelectorAll(".tab")) {
    tab.classList.toggle("active", tab.dataset.panel === id);
  }
  for (const panel of document.querySelectorAll(".panel")) {
    panel.classList.toggle("active", panel.id === id);
  }
}

function openSheet(id, options = {}) {
  const preserveUtility = Boolean(options.preserveUtility);
  if (!preserveUtility) {
    closeUtilityPanel();
  }
  const node = document.getElementById(id);
  if (!node) return;
  if (id === "quickEntrySheet") {
    const dateInput = $("#quickEntryForm [name=date]");
    if (dateInput && !dateInput.value) dateInput.value = new Date().toISOString().slice(0, 10);
    const currencyInput = $("#quickEntryForm [name=currency_original]");
    if (currencyInput && state.settings?.base_currency) {
      currencyInput.value = ensureUICurrency(state.settings.base_currency);
    }
    setQuickEntryType(state.quickEntryType || "expense");
    void updateQuickEntryFlow();
  }
  if (id === "budgetSheet") {
    const monthInput = $("#quickBudgetForm [name=month]");
    if (monthInput) monthInput.value = state.month;
  }
  if (id === "settingsSheet") {
    $("#quickSettingsForm [name=user_id]").value = String(state.userId);
    $("#quickSettingsForm [name=ui_language]").value = ensureUILanguage(state.settings?.ui_language || "en");
  }
  node.classList.remove("hidden");
  node.setAttribute("aria-hidden", "false");
  syncSheetOpenState();
}

function closeSheet(id) {
  const node = document.getElementById(id);
  if (!node) return;
  node.classList.add("hidden");
  node.setAttribute("aria-hidden", "true");
  syncSheetOpenState();
}

function closeAllSheets() {
  for (const sheet of document.querySelectorAll(".sheet")) {
    sheet.classList.add("hidden");
    sheet.setAttribute("aria-hidden", "true");
  }
  syncSheetOpenState();
}

function syncSheetOpenState() {
  const anyOpen = Array.from(document.querySelectorAll(".sheet")).some(
    (sheet) => !sheet.classList.contains("hidden")
  );
  document.body.classList.toggle("sheet-open", anyOpen);
}

function openUtilityPanel(panelId) {
  closeAllSheets();
  const panel = document.getElementById(panelId);
  if (!panel) return;
  document.body.classList.add("utility-mode");
  for (const p of document.querySelectorAll(".panel")) {
    p.classList.remove("utility-open");
    p.classList.toggle("active", p.id === "dashboardPanel");
  }
  panel.classList.add("utility-open");
  panel.classList.add("active");
  $("#closeUtilityBtn").classList.remove("hidden");
}

function closeUtilityPanel() {
  document.body.classList.remove("utility-mode");
  for (const panel of document.querySelectorAll(".panel")) {
    panel.classList.remove("utility-open");
    panel.classList.toggle("active", panel.id === "dashboardPanel");
  }
  const closeBtn = $("#closeUtilityBtn");
  if (closeBtn) closeBtn.classList.add("hidden");
  state.utilityReturnSheet = "";
}

function syncControlState() {
  const uid = Number($("#userIdInput").value || "1");
  state.userId = Number.isInteger(uid) && uid > 0 ? uid : 1;
  state.month = $("#monthInput").value || new Date().toISOString().slice(0, 7);
}

async function api(path, init = {}) {
  const method = String(init.method || "GET").toUpperCase();
  const clientRequestId = generateClientRequestId();
  const startedAt = Date.now();
  const headers = {
    "x-user-id": String(state.userId),
    "x-client-request-id": clientRequestId,
    ...(init.headers || {})
  };
  if (!headers["content-type"] && init.body !== undefined) {
    headers["content-type"] = "application/json";
  }
  let res;
  try {
    res = await fetch(path, { ...init, headers });
  } catch (networkError) {
    const durationMs = Date.now() - startedAt;
    const message = String(networkError?.message || "Network request failed.");
    recordRequestTrace({
      time: new Date().toISOString(),
      method,
      path,
      request_id: clientRequestId,
      client_request_id: clientRequestId,
      server_request_id: "",
      status: 0,
      duration_ms: durationMs,
      ok: false,
      error_message: message
    });
    const error = new Error(message);
    error.requestId = clientRequestId;
    error.status = 0;
    throw error;
  }
  const durationMs = Date.now() - startedAt;
  const serverRequestId = res.headers.get("x-request-id") || "";
  const requestId = serverRequestId || clientRequestId;
  const payload = await safeJson(res);
  if (!res.ok) {
    const detail =
      typeof payload?.error === "string"
        ? payload.error
        : payload?.error
          ? JSON.stringify(payload.error)
          : `${res.status} ${res.statusText}`;
    recordRequestTrace({
      time: new Date().toISOString(),
      method,
      path,
      request_id: requestId,
      client_request_id: clientRequestId,
      server_request_id: serverRequestId,
      status: res.status,
      duration_ms: durationMs,
      ok: false,
      error_message: detail
    });
    const error = new Error(detail);
    error.requestId = requestId;
    error.status = res.status;
    error.payload = payload;
    throw error;
  }
  recordRequestTrace({
    time: new Date().toISOString(),
    method,
    path,
    request_id: requestId,
    client_request_id: clientRequestId,
    server_request_id: serverRequestId,
    status: res.status,
    duration_ms: durationMs,
    ok: true,
    error_message: ""
  });
  return payload;
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

function showErrorToast(error) {
  showToast(formatErrorForToast(error), true);
}

function formatErrorForToast(error) {
  const fallback = "Unknown error";
  const message = String(error?.message || fallback);
  const requestId = error?.requestId || "";
  return requestId ? `[req:${requestId}] ${message}` : message;
}

function showRefreshFailureToast(error) {
  const message = t("refreshFailedAfterSave");
  const requestId = error?.requestId || "";
  showToast(requestId ? `${message} [req:${requestId}]` : message, true);
}

function generateClientRequestId() {
  const random = Math.random().toString(36).slice(2, 8);
  return `c_${Date.now().toString(36)}_${random}`;
}

function recordRequestTrace(entry) {
  state.debug.requests.unshift(entry);
  if (state.debug.requests.length > state.debug.maxEntries) {
    state.debug.requests = state.debug.requests.slice(0, state.debug.maxEntries);
  }
  renderDebugPanel();
}

function recordRuntimeError(entry) {
  state.debug.runtimeErrors.unshift({
    time: new Date().toISOString(),
    source: entry.source || "runtime",
    message: String(entry.message || "Runtime error"),
    stack: String(entry.stack || ""),
    filename: String(entry.filename || ""),
    line: Number(entry.line || 0),
    column: Number(entry.column || 0)
  });
  if (state.debug.runtimeErrors.length > state.debug.maxEntries) {
    state.debug.runtimeErrors = state.debug.runtimeErrors.slice(0, state.debug.maxEntries);
  }
  renderDebugPanel();
}

function renderDebugPanel() {
  const debugPanel = $("#debugPanel");
  const requestList = $("#debugRequestList");
  const runtimeList = $("#debugRuntimeList");
  const countHint = $("#debugCountHint");
  if (!debugPanel || !requestList || !runtimeList || !countHint) return;

  const filterText = String(state.debug.filter || "").toLowerCase();
  let requestRows = [...state.debug.requests];
  if (state.debug.onlyFailed) {
    requestRows = requestRows.filter((row) => !row.ok);
  }
  if (filterText) {
    requestRows = requestRows.filter((row) =>
      `${row.method} ${row.path} ${row.status} ${row.error_message} ${row.request_id}`
        .toLowerCase()
        .includes(filterText)
    );
  }
  const runtimeRows = filterText
    ? state.debug.runtimeErrors.filter((row) =>
        `${row.source} ${row.message} ${row.stack}`.toLowerCase().includes(filterText)
      )
    : [...state.debug.runtimeErrors];

  countHint.textContent = `${requestRows.length}/${state.debug.requests.length}`;
  requestList.innerHTML = requestRows.length
    ? requestRows
        .map((row) => {
          const cls = row.ok ? "debug-row" : "debug-row fail";
          const statusLabel = row.ok ? "ok" : "fail";
          return `
            <article class="${cls}">
              <div class="head">
                <strong class="mono">${escapeHtml(row.method)} ${escapeHtml(String(row.status))}</strong>
                <span class="muted">${escapeHtml(statusLabel)} · ${escapeHtml(String(row.duration_ms))}ms</span>
              </div>
              <div class="meta mono">${escapeHtml(row.path)}</div>
              <div class="meta mono">req=${escapeHtml(row.request_id || "-")}</div>
              ${row.error_message ? `<div class="meta">${escapeHtml(row.error_message)}</div>` : ""}
            </article>
          `;
        })
        .join("")
    : `<div class="list-row muted">${escapeHtml(t("debugNoRequests"))}</div>`;

  runtimeList.innerHTML = runtimeRows.length
    ? runtimeRows
        .map(
          (row) => `
            <article class="debug-row fail">
              <div class="head">
                <strong>${escapeHtml(row.source)}</strong>
                <span class="muted">${escapeHtml(new Date(row.time).toLocaleTimeString())}</span>
              </div>
              <div class="meta">${escapeHtml(row.message)}</div>
              ${
                row.filename
                  ? `<div class="meta mono">${escapeHtml(row.filename)}:${escapeHtml(
                      String(row.line)
                    )}:${escapeHtml(String(row.column))}</div>`
                  : ""
              }
              ${row.stack ? `<div class="meta mono">${escapeHtml(row.stack.slice(0, 240))}</div>` : ""}
            </article>
          `
        )
        .join("")
    : `<div class="list-row muted">${escapeHtml(t("debugNoRuntime"))}</div>`;
}

async function copyDiagnosticsToClipboard() {
  const payload = {
    generated_at: new Date().toISOString(),
    user_id: state.userId,
    requests: state.debug.requests,
    runtime_errors: state.debug.runtimeErrors
  };
  const text = JSON.stringify(payload, null, 2);
  try {
    await navigator.clipboard.writeText(text);
    showToast(t("debugCopyDone"));
  } catch (error) {
    showToast(t("debugCopyFailed"), true);
    recordRuntimeError({
      source: "clipboard",
      message: String(error?.message || "Clipboard write failed."),
      stack: error?.stack || ""
    });
  }
}

async function loadAll() {
  try {
    syncControlState();
    loadUiState();
    await Promise.all([loadSettings(), loadCategories(), loadAccounts(), loadProviders()]);
    await Promise.all([
      loadDashboard(),
      loadTransactions(),
      loadBudgets(),
      loadYearlyBudgets(),
      loadReview(),
      loadRisk()
    ]);
    await loadTrendData();
    showToast(t("loadedUser", { id: String(state.userId) }));
  } catch (error) {
    showErrorToast(error);
  }
}

async function loadSettings() {
  state.settings = (await api("/api/v1/settings")) || {
    base_currency: "USD",
    timezone: "UTC",
    ui_language: "en",
    default_ai_provider_id: null
  };
  const uiLanguage = ensureUILanguage(state.settings.ui_language || "en");
  state.settings.ui_language = uiLanguage;
  const uiBase = ensureUICurrency(state.settings.base_currency || "USD");
  $("#settingsForm [name=ui_language]").value = uiLanguage;
  $("#settingsForm [name=base_currency]").value = uiBase;
  $("#settingsForm [name=timezone]").value = state.settings.timezone || "UTC";
  $("#quickSettingsForm [name=ui_language]").value = uiLanguage;
  $("#quickSettingsForm [name=base_currency]").value = uiBase;
  $("#quickSettingsForm [name=timezone]").value = state.settings.timezone || "UTC";
  $("#quickSettingsForm [name=user_id]").value = String(state.userId);
  $("#quickEntryForm [name=currency_original]").value = uiBase;
  const toggleCashFlow = $("#toggleCashFlow");
  const toggleRisk = $("#toggleRisk");
  const toggleTrend = $("#toggleTrend");
  const toggleDebug = $("#toggleDebug");
  const debugOnlyFailed = $("#debugOnlyFailed");
  const debugFilterInput = $("#debugFilterInput");
  if (toggleCashFlow) toggleCashFlow.checked = Boolean(state.ui.showCashFlow);
  if (toggleRisk) toggleRisk.checked = Boolean(state.ui.showRisk);
  if (toggleTrend) toggleTrend.checked = Boolean(state.ui.showTrend);
  if (toggleDebug) toggleDebug.checked = Boolean(state.ui.showDebug);
  if (debugOnlyFailed) debugOnlyFailed.checked = Boolean(state.debug.onlyFailed);
  if (debugFilterInput) debugFilterInput.value = state.debug.filter || "";
  applyAdvancedVisibility();
  renderDebugPanel();
  applyI18n();
}

async function loadCategories() {
  state.categories = (await api("/api/v1/categories")) || {};
  renderCategoryTree();
  populateL1Selects();
  populateQuickEntryL1();
  populateQuickBudgetL1();
}

async function loadAccounts() {
  state.accounts = (await api("/api/v1/accounts")) || [];
  renderAccounts();
  populateAccountSelects();
  populateQuickEntryAccounts();
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
      select.appendChild(new Option(withL1Emoji(name), name));
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
    target.appendChild(new Option(withL2Emoji(row.name), row.name));
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

function populateQuickEntryL1() {
  const select = $("#quickEntryForm [name=category_l1]");
  if (!select) return;
  const activeL1 = Object.entries(state.categories || {})
    .filter(([, cfg]) => cfg.active)
    .map(([name]) => name);
  select.innerHTML = "";
  for (const name of activeL1) {
    select.appendChild(new Option(withL1Emoji(name), name));
  }
  populateQuickEntryL2();
}

function populateQuickEntryL2() {
  const l1Select = $("#quickEntryForm [name=category_l1]");
  const l2Select = $("#quickEntryForm [name=category_l2]");
  if (!l1Select || !l2Select) return;
  const l1 = l1Select.value;
  const rows = state.categories?.[l1]?.l2 || [];
  l2Select.innerHTML = "";
  for (const row of rows) {
    if (!row.active) continue;
    l2Select.appendChild(new Option(withL2Emoji(row.name), row.name));
  }
  void updateQuickEntryFlow();
}

function populateQuickEntryAccounts() {
  const select = $("#quickEntryForm [name=account_from_id]");
  const selectTo = $("#quickEntryForm [name=account_to_id]");
  if (!select) return;
  select.innerHTML = `<option value="">-- ${escapeHtml(t("selectAccount"))} --</option>`;
  for (const account of state.accounts || []) {
    const label = `${account.name} · ${account.type} · ${formatMoney(account.balance)} ${account.currency}`;
    select.appendChild(new Option(label, String(account.id)));
  }
  if (selectTo) {
    selectTo.innerHTML = `<option value="">-- ${escapeHtml(t("selectAccount"))} --</option>`;
    for (const account of state.accounts || []) {
      const label = `${account.name} · ${account.type} · ${formatMoney(account.balance)} ${account.currency}`;
      selectTo.appendChild(new Option(label, String(account.id)));
    }
  }
  void updateQuickEntryFlow();
}

function populateQuickBudgetL1() {
  const select = $("#quickBudgetForm [name=category_l1]");
  if (!select) return;
  const activeL1 = Object.entries(state.categories || {})
    .filter(([, cfg]) => cfg.active)
    .map(([name]) => name);
  select.innerHTML = "";
  for (const name of activeL1) {
    select.appendChild(new Option(withL1Emoji(name), name));
  }
}

function setupQuickAmountWheel() {
  const wheel = $("#quickAmountWheel");
  const amountInput = $("#quickEntryForm [name=amount_original]");
  const amountDisplay = $("#quickAmountDisplay");
  if (!wheel || !amountInput || !amountDisplay) return;
  let lastVibeAt = 0;
  wheel.addEventListener("input", () => {
    const numeric = clampQuickAmount(wheel.value);
    amountInput.value = String(numeric);
    syncQuickAmountDisplay(numeric);
    validateQuickEntryAmount();
    const now = Date.now();
    if (navigator.vibrate && now - lastVibeAt > 24) {
      navigator.vibrate(8);
      lastVibeAt = now;
    }
  });
  amountInput.addEventListener("input", () => {
    const numeric = clampQuickAmount(amountInput.value);
    amountInput.value = String(numeric);
    wheel.value = String(Math.round(numeric));
    syncQuickAmountDisplay(numeric);
    validateQuickEntryAmount();
  });
  syncQuickAmountDisplay(amountInput.value || 0);
}

async function updateQuickEntryFlow() {
  const l1 = $("#quickEntryForm [name=category_l1]")?.value || "";
  const l2 = $("#quickEntryForm [name=category_l2]")?.value || "";
  const accountId = parseOptionalInt($("#quickEntryForm [name=account_from_id]")?.value);
  const accountToId = parseOptionalInt($("#quickEntryForm [name=account_to_id]")?.value);
  const currency = ensureUICurrency($("#quickEntryForm [name=currency_original]")?.value || "USD");

  const isExpense = state.quickEntryType === "expense";
  const isIncome = state.quickEntryType === "income";
  const isTransfer = state.quickEntryType === "transfer";
  toggleQuickStep("quickStepL1", isExpense);
  toggleQuickStep("quickStepL2", isExpense && Boolean(l1));
  toggleQuickStep("quickStepSpend", isExpense ? Boolean(l1 && l2) : true);

  const spendReady = isExpense
    ? Boolean(accountId && currency)
    : isIncome
      ? Boolean(accountToId && currency)
      : Boolean(accountId && accountToId && currency);
  const amountStepVisible = isExpense ? Boolean(l1 && l2 && spendReady) : spendReady;
  toggleQuickStep("quickStepAmount", amountStepVisible);

  if (!amountStepVisible) {
    applyQuickEntryMax(0, currency);
    validateQuickEntryAmount();
    return;
  }
  if (isExpense || isTransfer) {
    await refreshQuickEntryAmountLimit(accountId, currency);
  } else {
    applyQuickEntryMax(50000, currency);
  }
}

function toggleQuickStep(id, visible) {
  const node = document.getElementById(id);
  if (!node) return;
  node.classList.toggle("hidden", !visible);
}

function setQuickEntryType(type) {
  const next = type === "income" || type === "transfer" ? type : "expense";
  state.quickEntryType = next;
  const expenseBtn = $("#quickTypeExpense");
  const incomeBtn = $("#quickTypeIncome");
  const transferBtn = $("#quickTypeTransfer");
  if (expenseBtn) expenseBtn.classList.toggle("active", next === "expense");
  if (incomeBtn) incomeBtn.classList.toggle("active", next === "income");
  if (transferBtn) transferBtn.classList.toggle("active", next === "transfer");

  const accountFrom = $("#quickEntryForm [name=account_from_id]");
  const accountFromWrap = $("#quickEntryAccountFromWrap");
  const accountToWrap = $("#quickEntryAccountToWrap");
  if (accountFrom) accountFrom.toggleAttribute("required", next !== "income");
  if (accountFromWrap) accountFromWrap.classList.toggle("hidden", next === "income");
  if (accountToWrap) accountToWrap.classList.toggle("hidden", next === "expense");
  const accountTo = $("#quickEntryForm [name=account_to_id]");
  if (accountTo) accountTo.toggleAttribute("required", next !== "expense");
  const l1Select = $("#quickEntryForm [name=category_l1]");
  const l2Select = $("#quickEntryForm [name=category_l2]");
  if (l1Select) l1Select.toggleAttribute("required", next === "expense");
  if (l2Select) l2Select.toggleAttribute("required", next === "expense");

  applyI18n();
  void updateQuickEntryFlow();
}

async function refreshQuickEntryAmountLimit(accountId, currency) {
  const currentSeq = ++quickEntryLimitReqSeq;
  const account = (state.accounts || []).find((x) => x.id === accountId);
  if (!account) {
    applyQuickEntryMax(0, currency);
    return;
  }

  let max = Number(account.balance || 0);
  try {
    const from = String(account.currency || "USD").toUpperCase();
    const to = ensureUICurrency(currency || "USD");
    if (from !== to) {
      const rate = await getFxRateCached(from, to);
      max = max * rate;
    }
  } catch {
    // keep local balance if quote fails
  }
  if (currentSeq !== quickEntryLimitReqSeq) return;
  applyQuickEntryMax(Math.max(0, Number(max.toFixed(2))), currency);
}

async function getFxRateCached(from, to) {
  if (from === to) return 1;
  const key = `${from}->${to}`;
  if (FX_QUOTE_CACHE.has(key)) return FX_QUOTE_CACHE.get(key);
  const quote = await api(`/api/v1/fx/quote?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
  const rate = Number(quote?.rate || 1);
  const safeRate = Number.isFinite(rate) && rate > 0 ? rate : 1;
  FX_QUOTE_CACHE.set(key, safeRate);
  return safeRate;
}

function applyQuickEntryMax(maxAmount, currency) {
  const amountInput = $("#quickEntryForm [name=amount_original]");
  const wheel = $("#quickAmountWheel");
  const hint = $("#quickAmountHint");
  if (!amountInput || !wheel || !hint) return;

  state.quickEntryMax = Number.isFinite(Number(maxAmount)) ? Math.max(0, Number(maxAmount)) : 0;
  amountInput.max = String(state.quickEntryMax);
  wheel.max = String(Math.max(1, Math.floor(state.quickEntryMax)));
  wheel.disabled = state.quickEntryMax <= 0;

  const current = clampQuickAmount(amountInput.value);
  amountInput.value = String(current);
  wheel.value = String(Math.min(Number(wheel.max), Math.floor(current)));
  syncQuickAmountDisplay(current);
  hint.textContent = t("maxSpendHint", {
    amount: formatMoney(state.quickEntryMax),
    currency: ensureUICurrency(currency || "USD")
  });
}

function clampQuickAmount(value) {
  const raw = Number(value || 0);
  const max = Math.max(0, Number(state.quickEntryMax || 0));
  if (!Number.isFinite(raw)) return 0;
  return Number(Math.min(Math.max(0, raw), max).toFixed(2));
}

function syncQuickAmountDisplay(value) {
  const amountDisplay = $("#quickAmountDisplay");
  if (!amountDisplay) return;
  amountDisplay.textContent = formatMoney(value);
}

function validateQuickEntryAmount() {
  const amountInput = $("#quickEntryForm [name=amount_original]");
  const saveBtn = $("#quickEntrySaveBtn");
  if (!amountInput || !saveBtn) return;
  const amount = Number(amountInput.value || 0);
  const valid = Number.isFinite(amount) && amount > 0 && amount <= Number(state.quickEntryMax || 0);
  saveBtn.disabled = !valid;
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
  const form = event.currentTarget;
  if (!(form instanceof HTMLFormElement)) return;
  const fd = new FormData(form);
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
    showToast("Account created");
    try {
      await Promise.all([loadAccounts(), loadDashboard()]);
      form.reset();
      $("#accountForm [name=currency]").value = "USD";
    } catch (error) {
      showRefreshFailureToast(error);
    }
  } catch (error) {
    showErrorToast(error);
  }
}

async function submitTransactionForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!(form instanceof HTMLFormElement)) return;
  const fd = new FormData(form);
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
    try {
      await refreshAfterLedgerChange();
      $("#transactionForm [name=amount_original]").value = "";
      $("#transactionForm [name=note]").value = "";
      $("#transactionForm [name=tags]").value = "";
    } catch (error) {
      showRefreshFailureToast(error);
    }
  } catch (error) {
    showErrorToast(error);
  }
}

async function submitQuickEntryForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!(form instanceof HTMLFormElement)) return;
  const fd = new FormData(form);
  const requestedAmount = Number(fd.get("amount_original"));
  const currencyCode = ensureUICurrency(String(fd.get("currency_original") || "USD").toUpperCase());
  if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
    showToast(t("invalidAmount"), true);
    return;
  }
  if ((state.quickEntryType === "expense" || state.quickEntryType === "transfer") && requestedAmount > Number(state.quickEntryMax || 0)) {
    showToast(
      t("amountExceeded", { amount: formatMoney(state.quickEntryMax), currency: currencyCode }),
      true
    );
    return;
  }
  const payload = {
    date: fd.get("date"),
    type: state.quickEntryType,
    amount_original: requestedAmount,
    currency_original: currencyCode,
    category_l1: state.quickEntryType === "expense" ? fd.get("category_l1") : undefined,
    category_l2: state.quickEntryType === "expense" ? fd.get("category_l2") : undefined,
    account_from_id:
      state.quickEntryType !== "income" ? parseOptionalInt(fd.get("account_from_id")) : undefined,
    account_to_id:
      state.quickEntryType !== "expense" ? parseOptionalInt(fd.get("account_to_id")) : undefined,
    transfer_reason: state.quickEntryType === "transfer" ? "normal" : undefined,
    note: fd.get("note") || "",
    tags: []
  };
  try {
    await api("/api/v1/transactions", { method: "POST", body: JSON.stringify(payload) });
    showToast(
      state.quickEntryType === "income"
        ? t("saveIncome")
        : state.quickEntryType === "transfer"
          ? t("saveTransfer")
          : t("expenseSaved")
    );
    try {
      await refreshAfterLedgerChange();
      closeSheet("quickEntrySheet");
      const amountInput = $("#quickEntryForm [name=amount_original]");
      if (amountInput) amountInput.value = "0";
      const wheel = $("#quickAmountWheel");
      if (wheel) wheel.value = "0";
      const display = $("#quickAmountDisplay");
      if (display) display.textContent = "0.00";
      validateQuickEntryAmount();
    } catch (error) {
      showRefreshFailureToast(error);
    }
  } catch (error) {
    showErrorToast(error);
  }
}

async function submitBudgetForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!(form instanceof HTMLFormElement)) return;
  const fd = new FormData(form);
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
    try {
      await Promise.all([loadBudgets(), loadDashboard()]);
    } catch (error) {
      showRefreshFailureToast(error);
    }
  } catch (error) {
    showErrorToast(error);
  }
}

async function submitQuickBudgetForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!(form instanceof HTMLFormElement)) return;
  const fd = new FormData(form);
  try {
    await api("/api/v1/budgets", {
      method: "POST",
      body: JSON.stringify({
        month: fd.get("month"),
        category_l1: fd.get("category_l1"),
        total_amount: Number(fd.get("total_amount"))
      })
    });
    showToast(t("budgetUpdated"));
    try {
      await Promise.all([loadBudgets(), loadDashboard()]);
    } catch (error) {
      showRefreshFailureToast(error);
    }
  } catch (error) {
    showErrorToast(error);
  }
}

async function submitYearlyBudgetForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!(form instanceof HTMLFormElement)) return;
  const fd = new FormData(form);
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
    try {
      await loadYearlyBudgets();
    } catch (error) {
      showRefreshFailureToast(error);
    }
  } catch (error) {
    showErrorToast(error);
  }
}

async function submitL1Form(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!(form instanceof HTMLFormElement)) return;
  const fd = new FormData(form);
  try {
    await api("/api/v1/categories/l1", {
      method: "POST",
      body: JSON.stringify({ name: fd.get("name") })
    });
    showToast("L1 category created");
    try {
      await loadCategories();
      form.reset();
    } catch (error) {
      showRefreshFailureToast(error);
    }
  } catch (error) {
    showErrorToast(error);
  }
}

async function submitL2Form(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!(form instanceof HTMLFormElement)) return;
  const fd = new FormData(form);
  try {
    await api("/api/v1/categories/l2", {
      method: "POST",
      body: JSON.stringify({
        l1_name: fd.get("l1_name"),
        name: fd.get("name")
      })
    });
    showToast("L2 category created");
    try {
      await loadCategories();
      form.reset();
    } catch (error) {
      showRefreshFailureToast(error);
    }
  } catch (error) {
    showErrorToast(error);
  }
}

async function submitSettingsForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!(form instanceof HTMLFormElement)) return;
  const fd = new FormData(form);
  try {
    await api("/api/v1/settings", {
      method: "PUT",
      body: JSON.stringify({
        base_currency: String(fd.get("base_currency")).toUpperCase(),
        timezone: fd.get("timezone"),
        ui_language: ensureUILanguage(fd.get("ui_language"))
      })
    });
    showToast(t("settingsUpdated"));
    try {
      await Promise.all([loadSettings(), loadDashboard(), loadBudgets(), loadYearlyBudgets()]);
    } catch (error) {
      showRefreshFailureToast(error);
    }
  } catch (error) {
    showErrorToast(error);
  }
}

async function submitQuickSettingsForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!(form instanceof HTMLFormElement)) return;
  const fd = new FormData(form);
  const nextUserId = Math.max(1, Number(fd.get("user_id") || 1));
  $("#userIdInput").value = String(nextUserId);
  state.userId = nextUserId;
  try {
    await api("/api/v1/settings", {
      method: "PUT",
      body: JSON.stringify({
        base_currency: String(fd.get("base_currency") || "USD").toUpperCase(),
        timezone: fd.get("timezone") || "UTC",
        ui_language: ensureUILanguage(fd.get("ui_language"))
      })
    });
    showToast(t("settingsUpdated"));
    closeSheet("settingsSheet");
    try {
      await loadAll();
    } catch (error) {
      showRefreshFailureToast(error);
    }
  } catch (error) {
    showErrorToast(error);
  }
}

async function submitProviderForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!(form instanceof HTMLFormElement)) return;
  const fd = new FormData(form);
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
    showToast("Provider created");
    try {
      await loadProviders();
      form.reset();
    } catch (error) {
      showRefreshFailureToast(error);
    }
  } catch (error) {
    showErrorToast(error);
  }
}

async function submitCaptureTextForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!(form instanceof HTMLFormElement)) return;
  const fd = new FormData(form);
  try {
    const payload = await api("/api/v1/transactions/parse-text", {
      method: "POST",
      body: JSON.stringify({ text: fd.get("text") })
    });
    setLatestExtraction(payload);
    showToast("Parsed with provider");
  } catch (error) {
    showErrorToast(error);
  }
}

async function submitCaptureImageForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!(form instanceof HTMLFormElement)) return;
  const fd = new FormData(form);
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
    showErrorToast(error);
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
    showErrorToast(error);
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
    showErrorToast(error);
  }
}

async function loadDashboard() {
  const dashboard = await api(`/api/v1/dashboard?month=${state.month}`);
  state.dashboard = dashboard;
  renderHeroSummary(dashboard);
  renderInfographics(dashboard);
}

async function loadRisk() {
  const risk = (await api(`/api/v1/metrics/risk?month=${state.month}`)) || {
    crypto_exposure: 0,
    income_volatility: 0,
    fixed_cost_ratio: 0
  };
  state.risk = risk;
  $("#riskMetrics").innerHTML = `
    <article class="list-row"><div class="row-main"><strong>${t("riskCryptoExposure")}</strong><span>${
      (risk.crypto_exposure * 100).toFixed(2)
    }%</span></div></article>
    <article class="list-row"><div class="row-main"><strong>${t("riskIncomeVolatility")}</strong><span>${
      (risk.income_volatility * 100).toFixed(2)
    }%</span></div></article>
    <article class="list-row"><div class="row-main"><strong>${t("riskFixedCostRatio")}</strong><span>${
      (risk.fixed_cost_ratio * 100).toFixed(2)
    }%</span></div></article>
  `;
}

function renderInfographics(dashboard) {
  renderPlannedBudgetCard(dashboard);
  renderCashFlowBars(dashboard);
}

function renderCashFlowBars(dashboard) {
  const target = $("#cashFlowBars");
  if (!target) return;
  const base = dashboard.base_currency || state.settings?.base_currency || "USD";
  const rows = [
    { label: t("labelIncome"), value: Number(dashboard.monthly_income || 0), tone: "income" },
    { label: t("labelExpense"), value: Number(dashboard.monthly_expense || 0), tone: "expense" },
    {
      label: t("labelNet"),
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

async function loadTrendData() {
  const { start, end } = ensureTrendRange();
  const rows = await api(`/api/v1/transactions?start=${start}&end=${end}`);
  const points = buildDailySeries(start, end, rows || []);
  state.trend.points = points;
  renderTrendChart();
}

function ensureTrendRange() {
  const today = new Date();
  const fallbackEnd = today.toISOString().slice(0, 10);
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const start = state.trend.start || firstOfMonth;
  const end = state.trend.end || fallbackEnd;
  state.trend.start = start;
  state.trend.end = end;
  const startInput = $("#trendStart");
  const endInput = $("#trendEnd");
  if (startInput) startInput.value = start;
  if (endInput) endInput.value = end;
  const modeInput = $("#trendMode");
  if (modeInput) modeInput.value = state.trend.mode || "expense";
  return { start, end };
}

function buildDailySeries(start, end, rows) {
  const dayMillis = 24 * 60 * 60 * 1000;
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return [];
  const days = Math.max(1, Math.floor((endDate - startDate) / dayMillis) + 1);
  const cappedDays = Math.min(days, 180);
  const dailyExpense = new Array(cappedDays).fill(0);
  const dailyNet = new Array(cappedDays).fill(0);
  for (const tx of rows) {
    const idx = Math.floor((new Date(tx.tx_date) - startDate) / dayMillis);
    if (idx < 0 || idx >= cappedDays) continue;
    const amount = Number(tx.amount_base || 0);
    if (tx.type === "expense") {
      dailyExpense[idx] += amount;
      dailyNet[idx] -= amount;
    } else if (tx.type === "income") {
      dailyNet[idx] += amount;
    }
  }
  const cumulative = [];
  let running = 0;
  for (let i = 0; i < cappedDays; i += 1) {
    running += dailyNet[i];
    cumulative.push(running);
  }
  const dates = [];
  for (let i = 0; i < cappedDays; i += 1) {
    const d = new Date(startDate.getTime() + i * dayMillis);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates.map((date, index) => ({
    date,
    expense: Number(dailyExpense[index].toFixed(2)),
    networth: Number(cumulative[index].toFixed(2))
  }));
}

function renderTrendChart() {
  const svg = $("#trendChart");
  const legend = $("#trendLegend");
  if (!svg) return;
  const points = state.trend.points || [];
  const mode = state.trend.mode || "expense";
  const series = points.map((p) => (mode === "networth" ? p.networth : p.expense));
  const width = 600;
  const height = 180;
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  if (!points.length) {
    svg.innerHTML = "";
    if (legend) legend.textContent = "";
    return;
  }
  const min = Math.min(...series, 0);
  const max = Math.max(...series, 1);
  const span = max - min || 1;
  const stepX = width / Math.max(1, points.length - 1);
  const coords = series.map((value, index) => {
    const x = index * stepX;
    const y = height - ((value - min) / span) * (height - 20) - 10;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const areaPoints = `0,${height} ${coords.join(" ")} ${width},${height}`;
  svg.innerHTML = `
    <polyline class="trend-grid" points="0,${height - 30} ${width},${height - 30}"></polyline>
    <polyline class="trend-area" points="${areaPoints}"></polyline>
    <polyline class="trend-line" points="${coords.join(" ")}"></polyline>
  `;
  if (legend) {
    const base = state.dashboard?.base_currency || state.settings?.base_currency || "USD";
    const last = series[series.length - 1] || 0;
    legend.textContent =
      mode === "networth"
        ? `${t("trendModeNetWorth")}: ${formatSignedMoney(last)} ${base}`
        : `${t("trendModeExpense")}: ${formatMoney(last)} ${base}`;
  }
}

function renderHeroSummary(dashboard) {
  const base = dashboard.base_currency || state.settings?.base_currency || "USD";
  const netWorth = Number(dashboard.net_worth || 0);
  const runway = dashboard.runway_months;
  const runwayLabel = Number.isFinite(Number(runway)) ? `${Number(runway).toFixed(1)}m` : "∞";

  setText("heroNetWorthValue", `${formatMoney(netWorth)} ${base}`);
  renderAccountComposition(dashboard);

  $("#heroSubMetrics").innerHTML = `
    <div class="hero-subcard"><div class="k">${t("metricMonthlyIncome")}</div><div class="v">${formatMoney(dashboard.monthly_income)} ${base}</div></div>
    <div class="hero-subcard"><div class="k">${t("metricMonthlyExpense")}</div><div class="v">${formatMoney(dashboard.monthly_expense)} ${base}</div></div>
    <div class="hero-subcard"><div class="k">${t("metricNetCashFlow")}</div><div class="v">${formatSignedMoney(dashboard.net_cash_flow)} ${base}</div></div>
    <div class="hero-subcard secondary"><div class="k">${t("metricRunwayMonths")}</div><div class="v">${runwayLabel}</div></div>
  `;
}

function renderAccountComposition(dashboard) {
  const bar = $("#heroCompositionBar");
  const legend = $("#heroCompositionLegend");
  if (!bar || !legend) return;
  const accounts = Array.isArray(dashboard.account_composition) ? dashboard.account_composition : [];
  const positive = accounts
    .map((row) => ({
      ...row,
      amount_base: Math.max(0, Number(row.amount_base || 0))
    }))
    .filter((row) => row.amount_base > 0.01)
    .sort((a, b) => b.amount_base - a.amount_base);
  const total = positive.reduce((sum, row) => sum + row.amount_base, 0);
  if (!positive.length || total <= 0) {
    bar.innerHTML = "";
    legend.innerHTML = "";
    return;
  }
  const palette = ["#1f1b16", "#3a2d1f", "#7c5c3c", "#c8a26a", "#e7c97a", "#8d6b4b", "#4c3b2a"];
  const maxSegments = 5;
  const top = positive.slice(0, maxSegments);
  const remainder = positive.slice(maxSegments);
  const otherSum = remainder.reduce((sum, row) => sum + row.amount_base, 0);
  const segments = [...top];
  if (otherSum > 0.01) {
    segments.push({ account_id: "other", name: "Other", amount_base: otherSum });
  }
  bar.innerHTML = segments
    .map((row, index) => {
      const pct = Math.max(2, (row.amount_base / total) * 100);
      const color = palette[index % palette.length];
      return `<div class="hero-part account" style="width:${pct}%; background:${color};"></div>`;
    })
    .join("");
  legend.innerHTML = segments
    .map((row, index) => {
      const color = palette[index % palette.length];
      const label = row.name || row.type || "Account";
      const pct = ((row.amount_base / total) * 100).toFixed(1);
      return `<span class="hero-legend-item"><span class="hero-legend-dot" style="background:${color};"></span>${escapeHtml(
        label
      )} · ${pct}%</span>`;
    })
    .join("");
}

function renderPlannedBudgetCard(dashboard) {
  const monthlyRows = dashboard.budget_status || [];
  const yearlyRows = dashboard.budget_status_yearly || [];
  const summary = $("#budgetPlanSummary");
  const list = $("#budgetPlanList");
  if (!summary || !list) return;
  if (!monthlyRows.length && !yearlyRows.length) {
    summary.classList.remove("hidden");
    summary.textContent = t("emptyNoBudgetMonth");
    list.innerHTML = "";
    return;
  }
  summary.textContent = "";
  summary.classList.add("hidden");

  const renderRows = (rows, periodLabel, limit = 3) =>
    [...rows]
      .sort((a, b) => Number(b.spent_amount || 0) - Number(a.spent_amount || 0))
      .slice(0, limit)
      .map((row) => {
        const total = Number(row.total_amount || 0);
        const used = Number(row.spent_amount || 0);
        const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
        const ratio = total > 0 ? used / total : 0;
        const tone = ratio >= 1 ? "overspend" : ratio >= 0.8 ? "warn" : "normal";
        return `
          <article class="budget-plan-row">
            <div class="top">
              <div class="budget-plan-name">
                <strong>${escapeHtml(withL1Emoji(row.category_l1))}</strong>
                <span class="budget-plan-period muted">/ ${escapeHtml(periodLabel)}</span>
              </div>
              <span class="${row.overspend ? "overspend" : ratio >= 0.8 ? "warn" : "muted"}">${formatMoney(
          used
        )} / ${formatMoney(total)}</span>
            </div>
            <div class="progress-wrap"><div class="progress-fill ${tone}" style="width:${pct}%"></div></div>
          </article>
        `;
      })
      .join("");

  const monthlyBlock = renderRows(monthlyRows, t("periodMonthly"));
  const yearlyBlock = renderRows(yearlyRows, t("periodYearly"));
  list.innerHTML = `${monthlyBlock}${yearlyBlock}`;
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
        <div class="row-main">
          <span class="muted mono">id: ${row.id}</span>
          <button class="btn btn-ghost" type="button" data-action="edit-account" data-id="${row.id}">${escapeHtml(
            t("edit")
          )}</button>
        </div>
      </article>`
    )
    .join("");
}

function openAccountEditSheet(accountId) {
  const account = (state.accounts || []).find((row) => row.id === accountId);
  if (!account) {
    showToast("Account not found", true);
    return;
  }
  state.editingAccountId = accountId;
  const form = $("#accountEditForm");
  if (!(form instanceof HTMLFormElement)) return;
  form.elements.account_id.value = String(account.id);
  form.elements.account_name.value = `${account.name} · ${account.currency}`;
  form.elements.type.value = String(account.type || "bank");
  form.elements.balance.value = String(Number(account.balance || 0));
  openSheet("accountEditSheet", { preserveUtility: true });
}

async function submitAccountEditForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!(form instanceof HTMLFormElement)) return;
  const fd = new FormData(form);
  const accountId = Number(fd.get("account_id"));
  const type = String(fd.get("type") || "").trim();
  const balance = Number(fd.get("balance"));
  if (!Number.isInteger(accountId) || accountId <= 0 || !type || !Number.isFinite(balance)) {
    showToast(t("invalidAmount"), true);
    return;
  }
  try {
    await api(`/api/v1/accounts/${accountId}`, {
      method: "PATCH",
      body: JSON.stringify({ type, balance })
    });
    showToast(t("accountUpdated"));
    try {
      await refreshAfterLedgerChange();
      closeSheet("accountEditSheet");
    } catch (error) {
      showRefreshFailureToast(error);
    }
  } catch (error) {
    showErrorToast(error);
  }
}

async function deleteCurrentAccount() {
  const accountId = Number(state.editingAccountId || 0);
  if (!Number.isInteger(accountId) || accountId <= 0) return;
  if (!window.confirm(t("accountDeleteConfirm"))) return;
  try {
    await api(`/api/v1/accounts/${accountId}`, { method: "DELETE" });
    showToast(t("accountDeleted"));
    state.editingAccountId = null;
    closeSheet("accountEditSheet");
    try {
      await refreshAfterLedgerChange();
    } catch (error) {
      showRefreshFailureToast(error);
    }
  } catch (error) {
    if (Number(error?.status) === 409) {
      showToast(formatErrorForToast(error), true);
      return;
    }
    showErrorToast(error);
  }
}

async function forceDeleteCurrentAccount() {
  const accountId = Number(state.editingAccountId || 0);
  if (!Number.isInteger(accountId) || accountId <= 0) return;
  const linkedCount = await getLinkedTransactionCount(accountId);
  if (
    !window.confirm(
      t("accountForceDeleteConfirm", {
        count: String(linkedCount)
      })
    )
  ) {
    return;
  }
  try {
    await api(`/api/v1/accounts/${accountId}?force=true`, { method: "DELETE" });
    showToast(t("accountForceDeleted"));
    state.editingAccountId = null;
    closeSheet("accountEditSheet");
    try {
      await refreshAfterLedgerChange();
    } catch (error) {
      showRefreshFailureToast(error);
    }
  } catch (error) {
    showErrorToast(error);
  }
}

async function getLinkedTransactionCount(accountId) {
  try {
    const usage = await api(`/api/v1/accounts/${accountId}/usage`);
    return Number(usage?.linked_transactions || 0);
  } catch {
    return 0;
  }
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
    target.innerHTML = `<div class="list-row muted">${escapeHtml(t("emptyNoTxMonth"))}</div>`;
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
            <strong>${txTypeLabel(row.type)} · ${formatMoney(row.amount_base)} ${
        state.settings?.base_currency || "USD"
      }</strong>
            <span class="muted">${row.tx_date}</span>
          </div>
          <div class="muted">${escapeHtml(t("original"))}: ${formatMoney(row.amount_original)} ${escapeHtml(
        row.currency_original
      )}</div>
          <div class="muted">${formatCategoryPair(row.category_l1, row.category_l2)} · ${escapeHtml(t("reason"))}: ${
            row.transfer_reason || "-"
          }</div>
          <div class="muted mono">${escapeHtml(t("from"))}: ${row.account_from_id || "-"} · ${escapeHtml(t("to"))}: ${row.account_to_id || "-"}</div>
          <div>${escapeHtml(row.note || "")}</div>
          ${tags}
        </article>`;
    })
    .join("");
}

async function loadBudgets() {
  const rows = await api(`/api/v1/budgets?month=${state.month}`);
  $("#budgetForm [name=month]").value = state.month;
  $("#quickBudgetForm [name=month]").value = state.month;
  const target = $("#budgetList");
  if (!rows.length) {
    target.innerHTML = `<div class="list-row muted">${escapeHtml(t("emptyNoMonthlyBudget"))}</div>`;
    const quickTarget = $("#quickBudgetList");
    if (quickTarget) quickTarget.innerHTML = `<div class="list-row muted">${escapeHtml(t("emptyNoQuickBudget"))}</div>`;
    return;
  }
  target.innerHTML = rows
    .map(
      (row) => `
      <article class="list-row">
        <div class="row-main">
          <strong>${escapeHtml(withL1Emoji(row.category_l1))}</strong>
          <span class="${row.overspend ? "overspend" : "muted"}">${formatMoney(row.spent_amount)} / ${formatMoney(row.total_amount)}</span>
        </div>
        <div class="muted">${escapeHtml(t("remaining"))}: ${formatMoney(row.remaining_amount)}</div>
      </article>`
    )
    .join("");
  const quickTarget = $("#quickBudgetList");
  if (quickTarget) {
    quickTarget.innerHTML = rows
      .map(
        (row) => `
        <article class="list-row">
          <div class="row-main">
            <strong>${escapeHtml(withL1Emoji(row.category_l1))}</strong>
            <span class="${row.overspend ? "overspend" : "muted"}">${formatMoney(row.spent_amount)} / ${formatMoney(row.total_amount)}</span>
          </div>
          <div class="muted">${escapeHtml(t("remaining"))}: ${formatMoney(row.remaining_amount)}</div>
        </article>`
      )
      .join("");
  }
}

async function loadYearlyBudgets() {
  const year = Number(state.month.slice(0, 4));
  const rows = await api(`/api/v1/budgets/yearly?year=${year}`);
  const target = $("#yearlyBudgetList");
  if (!rows.length) {
    target.innerHTML = `<div class="list-row muted">${escapeHtml(t("emptyNoYearlyBudget"))}</div>`;
    return;
  }
  target.innerHTML = rows
    .map(
      (row) => `
      <article class="list-row">
        <div class="row-main">
          <strong>${escapeHtml(withL1Emoji(row.category_l1))}</strong>
          <span class="${row.overspend ? "overspend" : "muted"}">${formatMoney(row.spent_amount)} / ${formatMoney(row.total_amount)}</span>
        </div>
        <div class="muted">${escapeHtml(t("remaining"))}: ${formatMoney(row.remaining_amount)}</div>
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
          <strong>${escapeHtml(withL1Emoji(row.category_l1))}</strong>
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
          <strong>${escapeHtml(withL1Emoji(row.category_l1 || ""))} / ${escapeHtml(withL2Emoji(row.category_l2 || ""))}</strong>
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
        .map((item) => `<span class="pill">${escapeHtml(withL2Emoji(item.name))}</span>`)
        .join("");
      return `
        <article class="list-row">
          <div class="row-main">
            <strong>${escapeHtml(withL1Emoji(name))}</strong>
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

function ensureUICurrency(value) {
  const code = String(value || "USD").toUpperCase();
  return UI_CURRENCIES.has(code) ? code : "USD";
}

function ensureUILanguage(value) {
  const code = String(value || "en").toLowerCase();
  return UI_LANGUAGES.has(code) ? code : "en";
}

function t(key, vars = {}) {
  const lang = ensureUILanguage(state.settings?.ui_language || "en");
  const template = I18N[lang]?.[key] ?? I18N.en[key] ?? key;
  return String(template).replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? ""));
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function applyI18n() {
  setText("subtitleText", t("subtitle"));
  setText("monthLabelText", t("month"));
  setText("dashboardTitle", t("dashboard"));
  setText("heroNetWorthLabel", t("metricNetWorth"));
  setText("heroCompositionLabel", t("netWorthComposition"));
  setText("heroLiquidLegend", t("labelLiquid"));
  setText("heroRestrictedLegend", t("labelRestricted"));
  setText("budgetPlanTitle", t("plannedBudget"));
  setText("trendTitle", t("trendTitle"));
  setText("trendFromLabel", t("trendFrom"));
  setText("trendToLabel", t("trendTo"));
  setText("cashFlowTitle", t("cashFlowPulse"));
  setText("riskTitle", t("riskMetrics"));
  setText(
    "quickEntryTitle",
    state.quickEntryType === "income"
      ? t("addIncome")
      : state.quickEntryType === "transfer"
        ? t("addTransfer")
        : t("addExpense")
  );
  setText("quickTypeExpense", t("txTypeExpense"));
  setText("quickTypeIncome", t("txTypeIncome"));
  setText("quickTypeTransfer", t("txTypeTransfer"));
  setText("quickEntryDateLabel", t("date"));
  setText("quickStepL1Title", t("stepL1Title"));
  setText("quickStepL2Title", t("stepL2Title"));
  setText("quickStepSpendTitle", t("stepSpendTitle"));
  setText("quickStepAmountTitle", t("stepAmountTitle"));
  setText("quickEntryL1Label", t("categoryL1"));
  setText("quickEntryL2Label", t("categoryL2"));
  setText("quickEntryAccountLabel", t("account"));
  setText("quickEntryAccountToLabel", t("accountTo"));
  setText("quickEntryCurrencyLabel", t("currency"));
  setText("quickEntryAmountLabel", t("amount"));
  setText("quickEntryWheelLabel", t("amountWheel"));
  setText("quickEntryNoteLabel", t("note"));
  setText(
    "quickEntrySaveBtn",
    state.quickEntryType === "income"
      ? t("saveIncome")
      : state.quickEntryType === "transfer"
        ? t("saveTransfer")
        : t("saveExpense")
  );
  setText("budgetSheetTitle", t("budgetEditor"));
  setText("quickBudgetMonthLabel", t("month"));
  setText("quickBudgetL1Label", t("categoryL1"));
  setText("quickBudgetTotalLabel", t("totalAmount"));
  setText("quickBudgetSaveBtn", t("saveBudget"));
  setText("settingsSheetTitle", t("settings"));
  setText("quickSettingsUserLabel", t("userId"));
  setText("quickSettingsLangLabel", t("language"));
  setText("quickSettingsBaseLabel", t("baseCurrency"));
  setText("quickSettingsTimezoneLabel", t("timezone"));
  setText("quickSettingsAdvancedLabel", t("advancedInsights"));
  setText("toggleCashFlowLabel", t("showCashFlow"));
  setText("toggleTrendLabel", t("showTrend"));
  setText("toggleRiskLabel", t("showRisk"));
  setText("toggleDebugLabel", t("showDebug"));
  setText("debugPanelTitle", t("debugPanel"));
  setText("debugOnlyFailedLabel", t("debugOnlyFailed"));
  setText("debugFilterLabel", t("debugFilter"));
  setText("debugCopyBtn", t("debugCopy"));
  setText("debugClearBtn", t("debugClear"));
  setText("debugRequestsTitle", t("debugRequests"));
  setText("debugRuntimeTitle", t("debugRuntime"));
  setText("quickSettingsSaveBtn", t("saveSettings"));
  setText("settingsLinkBudget", t("advancedBudget"));
  setText("settingsLinkAccounts", t("accounts"));
  setText("settingsLinkReview", t("monthlyReview"));
  setText("settingsLinkCategories", t("categories"));
  setText("settingsLinkAi", t("aiProviders"));
  setText("accountEditTitle", t("editAccount"));
  setText("accountEditNameLabel", t("account"));
  setText("accountEditTypeLabel", t("accountType"));
  setText("accountEditBalanceLabel", t("amount"));
  setText("accountEditSaveBtn", t("saveAccount"));
  setText("accountDeleteBtn", t("deleteAccount"));
  setText("accountForceDeleteBtn", t("forceDeleteAccount"));
  setText("closeUtilityBtn", "←");
  const utilityBtn = $("#closeUtilityBtn");
  if (utilityBtn) utilityBtn.setAttribute("aria-label", t("back"));
  const quickNote = document.querySelector("#quickEntryForm [name=note]");
  if (quickNote) {
    quickNote.placeholder = ensureUILanguage(state.settings?.ui_language) === "zh" ? "可选" : "optional";
  }
  if ((state.accounts || []).length) {
    populateQuickEntryAccounts();
  }
  const quickCurrency = $("#quickEntryForm [name=currency_original]")?.value || "USD";
  applyQuickEntryMax(state.quickEntryMax, quickCurrency);
  const trendMode = $("#trendMode");
  if (trendMode) {
    const optionExpense = trendMode.querySelector('option[value="expense"]');
    const optionNetworth = trendMode.querySelector('option[value="networth"]');
    if (optionExpense) optionExpense.textContent = t("trendModeExpense");
    if (optionNetworth) optionNetworth.textContent = t("trendModeNetWorth");
  }
  for (const button of document.querySelectorAll("[data-close-sheet]")) {
    if (button instanceof HTMLButtonElement) {
      button.textContent = t("close");
    }
  }
  const debugFilterInput = $("#debugFilterInput");
  if (debugFilterInput) {
    debugFilterInput.placeholder = t("debugFilterPlaceholder");
  }
  renderDebugPanel();
}

function applyAdvancedVisibility() {
  const cashFlow = $("#cashFlowCard");
  const trendCard = $("#trendCard");
  const riskCard = $("#riskCard");
  const debugPanel = $("#debugPanel");
  if (cashFlow) cashFlow.classList.toggle("hidden", !state.ui.showCashFlow);
  if (trendCard) trendCard.classList.toggle("hidden", !state.ui.showTrend);
  if (riskCard) riskCard.classList.toggle("hidden", !state.ui.showRisk);
  if (debugPanel) debugPanel.classList.toggle("hidden", !state.ui.showDebug);
}

function loadUiState() {
  try {
    const raw = localStorage.getItem("nfos_ui_state");
    if (!raw) return;
    const parsed = JSON.parse(raw);
    state.ui.showCashFlow = Boolean(parsed.showCashFlow);
    state.ui.showTrend = Boolean(parsed.showTrend);
    state.ui.showRisk = Boolean(parsed.showRisk);
    state.ui.showDebug = Boolean(parsed.showDebug);
    if (parsed.debug) {
      state.debug.onlyFailed = Boolean(parsed.debug.onlyFailed);
      state.debug.filter = String(parsed.debug.filter || "");
    }
    if (parsed.trend) {
      state.trend.start = parsed.trend.start || state.trend.start;
      state.trend.end = parsed.trend.end || state.trend.end;
      state.trend.mode = parsed.trend.mode || state.trend.mode;
    }
  } catch {
    // ignore localStorage errors
  }
}

function persistUiState() {
  try {
    localStorage.setItem(
      "nfos_ui_state",
      JSON.stringify({
        showCashFlow: state.ui.showCashFlow,
        showTrend: state.ui.showTrend,
        showRisk: state.ui.showRisk,
        showDebug: state.ui.showDebug,
        trend: {
          start: state.trend.start,
          end: state.trend.end,
          mode: state.trend.mode
        },
        debug: {
          onlyFailed: state.debug.onlyFailed,
          filter: state.debug.filter
        }
      })
    );
  } catch {
    // ignore localStorage errors
  }
}

function withL1Emoji(name) {
  const label = String(name || "").trim();
  if (!label || label === "-") return "-";
  return `${CATEGORY_L1_EMOJI[label] || "🏷️"} ${label}`;
}

function withL2Emoji(name) {
  const label = String(name || "").trim();
  if (!label || label === "-") return "-";
  return `${CATEGORY_L2_EMOJI[label] || "🔹"} ${label}`;
}

function formatCategoryPair(l1, l2) {
  const left = l1 ? withL1Emoji(l1) : "-";
  const right = l2 ? withL2Emoji(l2) : "-";
  return `${left} / ${right}`;
}

function txTypeLabel(type) {
  if (type === "expense") return t("txTypeExpense");
  if (type === "income") return t("txTypeIncome");
  if (type === "transfer") return t("txTypeTransfer");
  return String(type || "").toUpperCase();
}
