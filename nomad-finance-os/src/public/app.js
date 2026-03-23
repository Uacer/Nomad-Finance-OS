const state = {
  month: "",
  userId: 1,
  accounts: [],
  categories: {},
  settings: null,
  agentTokens: [],
  transactions: [],
  dashboard: null,
  risk: null,
  utilityReturnSheet: "",
  editingAccountId: null,
  editingTransactionId: null,
  detailTransactionId: null,
  quickEntryMax: 0,
  quickEntryType: "expense",
  txFilters: {
    tag: "",
    type: "",
    categoryL1: "",
    start: "",
    end: ""
  },
  auth: {
    ready: false,
    authenticated: false,
    user: null,
    allowDevBypass: false,
    devBypass: false,
    pendingEmail: "",
    step: "email_step",
    submitting: false,
    resendCooldownSec: 0
  },
  latestAgentTokenPlaintext: "",
  accountPeriod: "7d",
  accountPeriodTxs: [],
  recentCompareRows: [],
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
    showRecentExpenses: true,
    showToday: true,
    showRecentCompare: false,
    showAccounts: true,
    showDebug: false,
    budgetPieView: false,
    currencyModeToggling: false,
    accountCompositionPercent: false,
    hideSensitiveAmounts: false
  },
  debug: {
    requests: [],
    runtimeErrors: [],
    onlyFailed: false,
    filter: "",
    maxEntries: 100
  },
  categoryEmoji: {
    l1: {},
    l2: {}
  },
  widgetsOpenedFromDashboard: false,
  onboarding: {
    stateLoaded: false,
    completed: false,
    currentStep: "step1",
    step: "step1",
    countryCode: "CN",
    timezone: "Asia/Shanghai",
    baseCurrency: "USD",
    incomeBand: "8000_20000",
    incomeEstimate: 0,
    budgetPool: 0,
    savingsBuffer: 0,
    budgetDraft: {},
    agentChoice: "",
    finishing: false
  },
  quickPreferences: {
    expense: {
      account_from_id: "",
      currency_original: ""
    },
    income: {
      account_to_id: "",
      currency_original: ""
    },
    transfer: {
      account_from_id: "",
      account_to_id: "",
      currency_original: "",
      transfer_reason: "normal"
    }
  }
};

const UI_CURRENCIES = new Set(["CNY", "EUR", "THB", "USD", "JPY", "KRW"]);
const UI_LANGUAGES = new Set(["en", "zh"]);
const UI_CURRENCY_DISPLAY_MODES = new Set(["code", "symbol"]);
const UI_THEMES = new Set(["system", "light", "dark", "aurora"]);
const CURRENCY_SYMBOL_MAP = {
  USD: "$",
  CNY: "¥",
  EUR: "€",
  THB: "฿",
  JPY: "¥",
  KRW: "₩"
};
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
const ACCOUNT_TYPE_META = Object.freeze({
  bank: { emoji: "🏦", i18nKey: "accountTypeBankName" },
  cash: { emoji: "💵", i18nKey: "accountTypeCashName" },
  wise: { emoji: "💸", i18nKey: "accountTypeWiseName" },
  crypto_wallet: { emoji: "₿", i18nKey: "accountTypeCryptoName" },
  exchange: { emoji: "📈", i18nKey: "accountTypeExchangeName" },
  alipay: { emoji: "🅰", i18nKey: "accountTypeAlipayName" },
  wechat: { emoji: "💬", i18nKey: "accountTypeWechatName" },
  restricted_cash: { emoji: "🔒", i18nKey: "accountTypeRestrictedName" }
});
const DEFAULT_CATEGORY_L1_LABELS = {
  Living: { en: "Living", zh: "生活" },
  Travel: { en: "Travel", zh: "旅行" },
  Work: { en: "Work", zh: "工作" },
  Investment: { en: "Investment", zh: "投资" },
  Lifestyle: { en: "Lifestyle", zh: "生活方式" },
  Study: { en: "Study", zh: "学习" }
};
const DEFAULT_CATEGORY_L2_LABELS = {
  Rent: { en: "Rent", zh: "房租" },
  Utilities: { en: "Utilities", zh: "水电煤" },
  Groceries: { en: "Groceries", zh: "杂货" },
  Healthcare: { en: "Healthcare", zh: "医疗" },
  Flights: { en: "Flights", zh: "航班" },
  Hotels: { en: "Hotels", zh: "酒店" },
  Visa: { en: "Visa", zh: "签证" },
  "Local Transport": { en: "Local Transport", zh: "本地交通" },
  SaaS: { en: "SaaS", zh: "软件订阅" },
  Coworking: { en: "Coworking", zh: "联合办公" },
  Equipment: { en: "Equipment", zh: "设备" },
  Contractor: { en: "Contractor", zh: "外包" },
  "Broker Fees": { en: "Broker Fees", zh: "券商手续费" },
  "On-chain Fees": { en: "On-chain Fees", zh: "链上手续费" },
  Custody: { en: "Custody", zh: "托管" },
  Dining: { en: "Dining", zh: "餐饮" },
  Entertainment: { en: "Entertainment", zh: "娱乐" },
  Shopping: { en: "Shopping", zh: "购物" },
  Fitness: { en: "Fitness", zh: "健身" },
  Courses: { en: "Courses", zh: "课程" },
  Books: { en: "Books", zh: "书籍" },
  Certification: { en: "Certification", zh: "认证" },
  Workshops: { en: "Workshops", zh: "工作坊" }
};
const TRANSFER_REASON_EMOJI = {
  normal: "🔁",
  loan: "↗️",
  borrow: "↙️",
  deposit_lock: "🔒",
  deposit_release: "🔓"
};
const ONBOARDING_INCOME_BANDS = new Set([
  "lt_3000",
  "3000_8000",
  "8000_20000",
  "20000_50000",
  "50000_plus"
]);
const ONBOARDING_STEPS = new Set(["step1", "step2", "step3", "completed"]);
const DEFAULT_ONBOARDING_COUNTRY_CODE = "CN";

const I18N = {
  en: {
    subtitle: "A simpler daily money cockpit.",
    month: "Month",
    tabDashboard: "Dashboard",
    tabTransactions: "Transactions",
    tabBudgets: "Budgets",
    tabAccounts: "Accounts",
    tabReview: "Monthly Review",
    tabCategories: "Categories",
    tabSettings: "Settings",
    dashboard: "Summary",
    pinned: "PINNED",
    cashFlowPulse: "📈 Cash Flow Pulse",
    liquiditySplit: "Liquidity Split",
    runwaySignal: "Runway Signal",
    riskMetrics: "⚠️ Risk Metrics",
    budgetStatus: "Budget Status (L1 only)",
    netWorthComposition: "🧩 Net Worth Composition",
    compositionToggleHint: "Click to switch amount / percent",
    plannedBudget: "📋 Planned Budget",
    recentExpenses: "🧾 Transactions",
    viewAllExpenses: "View All",
    budgetPlanSummary: "Planned {planned} · Spent {spent} · Remaining {remaining}",
    budgetViewToggleToPie: "Show pie view",
    budgetViewToggleToList: "Show list view",
    budgetTabList: "List",
    budgetTabPie: "Pie",
    budgetPieCenterLabel: "Spent",
    budgetPieEmpty: "No spent budget yet.",
    budgetPieOther: "Other",
    budgetScope: "Scope",
    budgetPeriod: "Period",
    budgetEditHint: "Set amount to 0 to remove this budget.",
    periodMonthly: "month",
    periodYearly: "yearly",
    editBudget: "Edit Budget",
    addExpense: "🧾 Add Expense",
    addIncome: "💰 Add Income",
    addTransfer: "🔁 Add Transfer",
    authTitle: "Nomad Finance OS",
    authSubtitle: "Sign in with your email verification code.",
    authEmailLabel: "Email",
    authContinueBtn: "Continue",
    authCodeLabel: "Verification Code",
    authHint: "We'll send a 6-digit code that expires in 10 minutes.",
    authSent: "Verification code sent. Check your inbox.",
    authResendSent: "Verification code resent.",
    authCodeSentTo: "Code sent to {email}. Enter it below.",
    authResendIn: "{seconds}s before you can resend code.",
    authResendBtn: "Resend verification code",
    authSignedIn: "Signed in successfully.",
    authCodeInvalid: "Verification code is invalid or expired.",
    authTooMany: "Too many attempts. Please try again later.",
    authEmailFailed: "Email delivery failed. Please try again.",
    authRequestFailed: "Failed to request verification code.",
    authVerifyFailed: "Verification failed. Please try again.",
    authSessionExpired: "Session expired. Please sign in again.",
    onboardingTitle: "Build Your Financial Profile",
    onboardingSubtitle: "Tell us about your baseline so we can personalize planning advice.",
    onboardingProgress: "Step {current} / 3",
    onboardingStep1Title: "Step 1 · Basic Profile",
    onboardingStep2Title: "Step 2 · Financial Snapshot",
    onboardingStep3Title: "Step 3 · Agent Setup",
    onboardingCountry: "Country / Region",
    onboardingTimezone: "Timezone",
    onboardingIncomeBand: "Monthly Income Range",
    onboardingGeoHint: "Default country is China. You can edit both country and timezone.",
    onboardingContinue: "Continue",
    onboardingStep2Intro:
      "Add at least one account. We'll suggest a monthly allocation ratio that you can adjust later in Budget.",
    onboardingCategoryHint: "Default categories are enabled. You can fine-tune them later.",
    onboardingAccountsTitle: "Accounts",
    onboardingCategoriesTitle: "Categories",
    onboardingBudgetTitle: "Suggested Monthly Budget",
    onboardingBudgetHint:
      "Based on your income band, here's an estimated monthly allocation by category. You can adjust it later in Budget.",
    onboardingBudgetRatioText: "Approx. {percent}% · {amount} {currency}/mo",
    onboardingBudgetHintWithValues:
      "Estimated income: {income} {currency} · Budget pool: {budget} {currency} · Buffer: {buffer} {currency}",
    onboardingNeedAccount: "Add at least one account before continuing.",
    onboardingSavedStep2: "Snapshot saved. You can move to the final step.",
    onboardingDefaultAccountName: "default",
    onboardingStep3Intro:
      "Nomad Finance OS supports smooth, fast bookkeeping with your own agent. Choose whether to connect now:",
    onboardingHasAgentYes: "Yes, connect now",
    onboardingHasAgentNo: "No, connect later",
    onboardingEnterProduct: "Enter Product",
    onboardingGoAgent: "Go to Agent Access",
    onboardingCountryPlaceholder: "US",
    onboardingCountryOptionCN: "China (CN)",
    onboardingCountryOptionUS: "United States (US)",
    onboardingCountryOptionHK: "Hong Kong SAR (HK)",
    onboardingCountryOptionMO: "Macao SAR (MO)",
    onboardingCountryOptionTW: "Taiwan (TW)",
    onboardingCountryOptionSG: "Singapore (SG)",
    onboardingCountryOptionJP: "Japan (JP)",
    onboardingCountryOptionKR: "South Korea (KR)",
    onboardingCountryOptionTH: "Thailand (TH)",
    onboardingCountryOptionMY: "Malaysia (MY)",
    onboardingCountryOptionGB: "United Kingdom (GB)",
    onboardingCountryOptionDE: "Germany (DE)",
    onboardingCountryOptionFR: "France (FR)",
    onboardingCountryOptionCA: "Canada (CA)",
    onboardingCountryOptionAU: "Australia (AU)",
    onboardingCountryOptionCH: "Switzerland (CH)",
    onboardingCountryOptionIN: "India (IN)",
    onboardingCountryOptionAE: "United Arab Emirates (AE)",
    onboardingTimezonePlaceholder: "Asia/Shanghai",
    onboardingAccountNamePlaceholder: "Account name",
    onboardingNewL1Placeholder: "New L1 category",
    onboardingNewL2Placeholder: "New L2 tag",
    onboardingAdd: "Add",
    onboardingAddL1: "Add L1",
    onboardingAddL2: "Add L2",
    onboardingNoAccounts: "No accounts yet.",
    onboardingNoCategories: "No active categories.",
    onboardingIncomeBandLt3000: "< 3,000",
    onboardingIncomeBand3000_8000: "3,000 - 8,000",
    onboardingIncomeBand8000_20000: "8,000 - 20,000",
    onboardingIncomeBand20000_50000: "20,000 - 50,000",
    onboardingIncomeBand50000Plus: "50,000+",
    close: "Close",
    date: "Date",
    type: "Type",
    stepL1Title: "Step 1 · 🗂️ Choose Category L1",
    stepL2Title: "Step 2 · 🏷️ Choose Category L2",
    stepTransferTitle: "Step 1 · 🔁 Choose Transfer Type",
    stepSpendTitle: "Step 3 · 💳 Account & Currency",
    stepAmountTitle: "Step 4 · 🎛️ Enter Amount",
    categoryL1: "Category L1",
    categoryL2: "Category L2",
    account: "Account",
    accountType: "Account Type",
    accountTypeBankName: "Bank",
    accountTypeCashName: "Cash",
    accountTypeWiseName: "Wise",
    accountTypeCryptoName: "Crypto",
    accountTypeExchangeName: "Exchange",
    accountTypeAlipayName: "Alipay",
    accountTypeWechatName: "WeChat",
    accountTypeRestrictedName: "Restricted",
    accountTo: "Account To",
    transferMode: "Transfer Type",
    currency: "Currency",
    fxRateOptional: "FX Rate (optional)",
    amount: "Amount",
    amountWheel: "Amount Wheel",
    quickDateHint: "Default: payment date",
    quickDateToggle: "Date",
    quickDateYesterday: "Yesterday",
    quickDateDayBefore: "2d ago",
    quickUnassignedHint: "No account selected. It will be saved to Unassigned Account.",
    note: "Note",
    tagsLabel: "Tags",
    saveExpense: "Save Expense",
    saveIncome: "Save Income",
    saveTransfer: "Save Transfer",
    budgetEditor: "Budget Editor",
    totalAmount: "Total Amount",
    saveBudget: "Save Budget",
    settings: "⚙️ Settings",
    navBackSettings: "‹ Settings",
    userId: "User ID",
    language: "Language",
    baseCurrency: "Base Currency",
    currencyDisplay: "Currency Display",
    currencyDisplayCode: "Code (USD)",
    currencyDisplaySymbol: "Symbol ($)",
    topCurrencyToggleHint: "Select base currency",
    heroCurrencyToggleHint: "Click currency unit to toggle Code/Symbol",
    hideAmounts: "Hide amounts",
    showAmounts: "Show amounts",
    theme: "Theme",
    themeSystem: "System",
    themeLight: "Light",
    themeDark: "Dark",
    themeAurora: "Aurora",
    timezone: "Timezone",
    saveSettings: "Save Settings",
    general: "General",
    advancedInsights: "Advanced Insights",
    showCashFlow: "Cash Flow Pulse",
    showTrend: "Spending Curve",
    showRisk: "Risk Metrics",
    showRecentExpenses: "Recent Transactions Card",
    showToday: "Today Card",
    showRecentCompare: "Recent 3-Day Card",
    showAccounts: "Accounts Card",
    showDebug: "Debug Panel",
    logout: "Logout",
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
    navBudget: "Budget",
    navAccounts: "Accounts",
    navReview: "Monthly Review",
    navCategories: "Categories",
    navAgentAccess: "Agent Access",
    budgetPanelTitle: "Budget",
    reviewSummaryHeading: "Summary",
    reviewExpenseBreakdown: "Expense Breakdown",
    reviewTopExpenses: "Top Expenses",
    refresh: "Refresh",
    dashboardWidgets: "Dashboard Widgets",
    showOnDashboard: "Show on Dashboard",
    addL1Bottom: "✏️ Add L1",
    addCategory: "Add Category",
    addL2Inline: "＋",
    addL2Action: "Add Tag",
    emptyNoL2Categories: "No L2 categories",
    promptL1Name: "New L1 category name",
    promptL2Name: "New tag (L2) for {l1}",
    categoryPromptTitleL1: "Add Category L1",
    categoryPromptTitleL2: "Add Tag to {l1}",
    categoryPromptTitleEditL1: "Edit Category {l1}",
    categoryPromptEmojiLabel: "Emoji",
    categoryPromptNameLabelL1: "Category Name",
    categoryPromptNameLabelL2: "Tag Name",
    categoryPromptParentLabel: "Category L1",
    categoryPromptSaveL1: "Create L1",
    categoryPromptSaveL2: "Create Tag",
    categoryPromptSaveEditL1: "Save Category",
    categoryPromptEmojiPlaceholder: "✨",
    categoryPromptNamePlaceholderL1: "e.g. Family",
    categoryPromptNamePlaceholderL2: "e.g. Gifts",
    editCategoryL1Action: "Edit category {l1}",
    confirmDeleteL2: "Delete tag \"{l2}\" under \"{l1}\"?",
    deleteTagAction: "Delete tag {l2}",
    categoryL1Created: "L1 category created",
    categoryL1Updated: "L1 category updated",
    categoryL2Created: "Tag created",
    categoryL2Deleted: "Tag deleted",
    agentAccess: "🤖 Agent Access",
    backToDashboard: "Back to Dashboard",
    back: "Back",
    edit: "Edit",
    editTransaction: "Edit Transaction",
    transactionDetailTitle: "Transaction Detail",
    transactionDetailAmount: "Amount",
    transactionDetailCategory: "Category",
    transactionDetailAccount: "Account",
    transactionDetailTime: "Time",
    transactionDetailCreatedAt: "Created at {time}",
    saveTransaction: "Save Transaction",
    deleteTransaction: "Delete Transaction",
    transactionDeleteConfirm: "Delete this transaction? This cannot be undone.",
    transactionUpdated: "Transaction updated",
    transactionDeleted: "Transaction deleted",
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
    emptyNoExpenseMonth: "No expense records for this month.",
    emptyNoExpenseToday: "No expenses today.",
    emptyNoRecentExpense: "No transactions yet.",
    txFilterTagPlaceholder: "Filter by tag...",
    txFilterAllTypes: "All types",
    txFilterAllCategories: "All categories",
    txFilterStartDate: "Start date",
    txFilterEndDate: "End date",
    txFilterApply: "Apply",
    txFilterReset: "Reset",
    recentSpendToday: "Today",
    recentSpendYesterday: "Yesterday",
    recentSpendDayBefore: "2d ago",
    emptyNoMonthlyBudget: "No monthly budgets.",
    emptyNoYearlyBudget: "No yearly budgets.",
    emptyNoQuickBudget: "No budgets yet.",
    recentCompareTitle: "📉 Spending Change",
    recentCompareSummaryQuiet: "No spending spikes over the past 7 days.",
    recentCompareSummaryDown: "Spent {amount} {currency} in the past 7 days, down {pct} vs last week.",
    recentCompareSummaryUp: "Spent {amount} {currency} in the past 7 days, up {pct} vs last week.",
    recentCompareSummaryFlat: "Spent {amount} {currency} in the past 7 days, in line with last week.",
    recentCompareSummaryEarlyNoBaseline:
      "Spent {amount} {currency} so far this week. No baseline for last week's {weekday}.",
    recentCompareSummaryEarlyDown:
      "Spent {amount} {currency} so far this week. Today's spending is down {pct} vs last week's {weekday}.",
    recentCompareSummaryEarlyUp:
      "Spent {amount} {currency} so far this week. Today's spending is up {pct} vs last week's {weekday}.",
    recentCompareSummaryEarlyFlat:
      "Spent {amount} {currency} so far this week. Today's spending is in line with last week's {weekday}.",
    recentCompareSummaryAvgDown:
      "Spent {amount} {currency} so far this week. Daily average is down {pct} vs last week.",
    recentCompareSummaryAvgUp:
      "Spent {amount} {currency} so far this week. Daily average is up {pct} vs last week.",
    recentCompareSummaryAvgFlat:
      "Spent {amount} {currency} so far this week. Daily average is in line with last week.",
    recentCompareSummaryAvgInsufficient:
      "Spent {amount} {currency} so far this week. Need more baseline data before judging trend.",
    recentCompareSummaryInsufficient:
      "Spent {amount} {currency} in the past 7 days. Need more baseline data before judging the trend.",
    recentCompareSummaryNoBaseline: "Spent {amount} {currency} in the past 7 days. No spending last week.",
    recentCompareStateQuiet: "Very Calm",
    recentCompareStateDown: "Cooling Down",
    recentCompareStateUp: "Elevated",
    recentCompareStateFlat: "Steady",
    recentCompareStateInsufficient: "Need More Data",
    recentCompareAxisMon: "Mon",
    recentCompareAxisTue: "Tue",
    recentCompareAxisWed: "Wed",
    recentCompareAxisThu: "Thu",
    recentCompareAxisFri: "Fri",
    recentCompareAxisSat: "Sat",
    recentCompareAxisSun: "Sun",
    relativeToday: "Today",
    relativeDayAgo: "{days} day ago",
    relativeDaysAgo: "{days} days ago",
    remaining: "Remaining",
    original: "original",
    reason: "reason",
    from: "from",
    to: "to",
    loadedUser: "Loaded user {id}",
    settingsUpdated: "Settings updated",
    budgetUpdated: "Budget updated",
    accountCreated: "Account created",
    transactionCreated: "Transaction created",
    monthlyBudgetSaved: "Monthly budget saved",
    yearlyBudgetSaved: "Yearly budget saved",
    monthlyReviewGenerated: "Monthly review snapshot generated",
    accountNotFound: "Account not found",
    transactionNotFound: "Transaction not found",
    invalidTransactionId: "Invalid transaction id",
    expenseSaved: "Expense saved",
    maxSpendHint: "max: {amount} {currency}",
    amountExceeded: "Amount exceeds account available balance ({amount} {currency}).",
    invalidAmount: "Please enter a valid amount.",
    txTypeExpense: "EXPENSE",
    txTypeIncome: "INCOME",
    txTypeTransfer: "TRANSFER",
    transferReasonNormal: "Internal",
    transferReasonLoan: "Loan",
    transferReasonBorrow: "Borrow",
    transferReasonDepositLock: "Deposit Lock",
    transferReasonDepositRelease: "Deposit Release",
    agentTokensTitle: "Agent API Tokens",
    agentTokensHint: "Create a token for your own agent. Token plaintext is shown in a popup only once.",
    agentAccessFlowHint:
      "Click + Token, create one token, then choose copy mode: Token only or Full Agent Setup.",
    agentTokenName: "Token Name",
    createAgentToken: "Create Token",
    agentTokenCreateSheetTitle: "Create Agent Token",
    agentTokenCreateSheetHint:
      "Give it an easy-to-remember name. After creation, you'll get two copy options for quick onboarding.",
    latestAgentToken: "Last Created Token (shown once)",
    agentTokenRevealTitle: "Token Created",
    agentTokenRevealHint: "",
    agentTokenRevealOptionToken: "Option B · Copy token only (plaintext hidden in UI)",
    agentTokenRevealOptionSetup:
      "Click \"Copy Full Agent Setup\", then paste and send it to your AI agent to complete setup (easy).",
    tokenCopied: "Token copied",
    tokenCopyMissing: "No token to copy",
    agentTokenCreated: "Agent token created",
    agentTokenRevoked: "Agent token revoked",
    copyToken: "Copy",
    copyTokenOnly: "Copy Token",
    copyAgentSetupWithToken: "Copy Full Agent Setup",
    agentSetupWithTokenCopied: "Full agent setup copied",
    agentQuickstartTitle: "Agent Quickstart",
    agentQuickstartHint:
      "Copy one setup block for another agent to download the skill and start calling this API.",
    copyAgentSetup: "Copy Agent Setup",
    agentSetupCopied: "Agent setup copied",
    revokeToken: "Revoke",
    tokenScopes: "Scopes",
    tokenLastUsed: "Last used",
    tokenNeverUsed: "Never",
    tokenStatusActive: "active",
    tokenStatusRevoked: "revoked",
    tokenListEmpty: "No agent tokens yet."
  },
  zh: {
    subtitle: "更轻量的日常财务驾驶舱。",
    month: "月份",
    tabDashboard: "总览",
    tabTransactions: "交易",
    tabBudgets: "预算",
    tabAccounts: "账户",
    tabReview: "月度回顾",
    tabCategories: "分类",
    tabSettings: "设置",
    dashboard: "总览",
    pinned: "置顶",
    cashFlowPulse: "📈 现金流脉冲",
    liquiditySplit: "流动性结构",
    runwaySignal: "Runway 信号",
    riskMetrics: "⚠️ 风险指标",
    budgetStatus: "预算进度（仅一级分类）",
    netWorthComposition: "🧩 净资产结构",
    compositionToggleHint: "点击可切换金额 / 百分比",
    plannedBudget: "📋 预算计划",
    recentExpenses: "🧾 交易记录",
    viewAllExpenses: "查看全部",
    budgetPlanSummary: "计划 {planned} · 已花 {spent} · 剩余 {remaining}",
    budgetViewToggleToPie: "切换为饼图",
    budgetViewToggleToList: "切换为列表",
    budgetTabList: "列表",
    budgetTabPie: "饼图",
    budgetPieCenterLabel: "已花",
    budgetPieEmpty: "暂无已花预算数据。",
    budgetPieOther: "其他",
    budgetScope: "范围",
    budgetPeriod: "周期",
    budgetEditHint: "将金额设为 0 可删除此预算。",
    periodMonthly: "月",
    periodYearly: "每年",
    editBudget: "编辑预算",
    addExpense: "🧾 新增支出",
    addIncome: "💰 新增收入",
    addTransfer: "🔁 新增转账",
    authTitle: "Nomad Finance OS",
    authSubtitle: "使用邮箱验证码登录。",
    authEmailLabel: "邮箱",
    authContinueBtn: "继续",
    authCodeLabel: "验证码",
    authHint: "我们会发送一个 10 分钟内有效的 6 位验证码。",
    authSent: "验证码已发送，请检查邮箱。",
    authResendSent: "验证码已重新发送。",
    authCodeSentTo: "验证码已发送到 {email}，请输入验证码。",
    authResendIn: "{seconds}s 后可重新发送验证码。",
    authResendBtn: "重新发送验证码",
    authSignedIn: "登录成功。",
    authCodeInvalid: "验证码无效或已过期。",
    authTooMany: "操作过于频繁，请稍后再试。",
    authEmailFailed: "邮件发送失败，请稍后重试。",
    authRequestFailed: "验证码发送失败，请重试。",
    authVerifyFailed: "验证码校验失败，请重试。",
    authSessionExpired: "登录已过期，请重新登录。",
    onboardingTitle: "完善你的财务画像",
    onboardingSubtitle: "通过这份问卷，我们会为后续规划建议建立基线。",
    onboardingProgress: "第 {current} / 3 步",
    onboardingStep1Title: "第 1 步 · 基础画像",
    onboardingStep2Title: "第 2 步 · 财务现状",
    onboardingStep3Title: "第 3 步 · Agent 引导",
    onboardingCountry: "国家/地区",
    onboardingTimezone: "时区",
    onboardingIncomeBand: "月收入区间",
    onboardingGeoHint: "国家默认中国（China），国家和时区都可以随时修改。",
    onboardingContinue: "继续",
    onboardingStep2Intro: "请至少创建一个账户。系统会先给出建议预算配比，后续可在预算页再调整。",
    onboardingCategoryHint: "分类已默认启用，后续可在分类页面再细调。",
    onboardingAccountsTitle: "账户",
    onboardingCategoriesTitle: "分类",
    onboardingBudgetTitle: "建议月预算",
    onboardingBudgetHint: "我们已根据你的收入区间生成分类预算配比，后续可在预算页自行调整。",
    onboardingBudgetRatioText: "约 {percent}% · {amount} {currency}/月",
    onboardingBudgetHintWithValues: "估算收入：{income} {currency} · 预算盘子：{budget} {currency} · 缓冲：{buffer} {currency}",
    onboardingNeedAccount: "请至少创建一个账户后再继续。",
    onboardingSavedStep2: "财务快照已保存，可以进入下一步。",
    onboardingDefaultAccountName: "默认账户",
    onboardingStep3Intro: "我们支持你的 agent 丝滑快速记账。请选择是否现在接入：",
    onboardingHasAgentYes: "有，我现在接入",
    onboardingHasAgentNo: "没有，稍后接入",
    onboardingEnterProduct: "进入产品",
    onboardingGoAgent: "前往 Agent Access",
    onboardingCountryPlaceholder: "CN",
    onboardingCountryOptionCN: "中国 (CN)",
    onboardingCountryOptionUS: "美国 (US)",
    onboardingCountryOptionHK: "中国香港 (HK)",
    onboardingCountryOptionMO: "中国澳门 (MO)",
    onboardingCountryOptionTW: "中国台湾 (TW)",
    onboardingCountryOptionSG: "新加坡 (SG)",
    onboardingCountryOptionJP: "日本 (JP)",
    onboardingCountryOptionKR: "韩国 (KR)",
    onboardingCountryOptionTH: "泰国 (TH)",
    onboardingCountryOptionMY: "马来西亚 (MY)",
    onboardingCountryOptionGB: "英国 (GB)",
    onboardingCountryOptionDE: "德国 (DE)",
    onboardingCountryOptionFR: "法国 (FR)",
    onboardingCountryOptionCA: "加拿大 (CA)",
    onboardingCountryOptionAU: "澳大利亚 (AU)",
    onboardingCountryOptionCH: "瑞士 (CH)",
    onboardingCountryOptionIN: "印度 (IN)",
    onboardingCountryOptionAE: "阿联酋 (AE)",
    onboardingTimezonePlaceholder: "Asia/Shanghai",
    onboardingAccountNamePlaceholder: "账户名称",
    onboardingNewL1Placeholder: "新增一级分类",
    onboardingNewL2Placeholder: "新增二级标签",
    onboardingAdd: "添加",
    onboardingAddL1: "新增 L1",
    onboardingAddL2: "新增 L2",
    onboardingNoAccounts: "还没有账户。",
    onboardingNoCategories: "暂无可用分类。",
    onboardingIncomeBandLt3000: "< 3,000",
    onboardingIncomeBand3000_8000: "3,000 - 8,000",
    onboardingIncomeBand8000_20000: "8,000 - 20,000",
    onboardingIncomeBand20000_50000: "20,000 - 50,000",
    onboardingIncomeBand50000Plus: "50,000+",
    close: "关闭",
    date: "日期",
    type: "类型",
    stepL1Title: "第 1 步 · 🗂️ 选择一级分类",
    stepL2Title: "第 2 步 · 🏷️ 选择二级分类",
    stepTransferTitle: "第 1 步 · 🔁 选择转账类型",
    stepSpendTitle: "第 3 步 · 💳 选择账户与币种",
    stepAmountTitle: "第 4 步 · 🎛️ 输入金额",
    categoryL1: "一级分类",
    categoryL2: "二级分类",
    account: "账户",
    accountType: "账户类型",
    accountTypeBankName: "银行",
    accountTypeCashName: "现金",
    accountTypeWiseName: "Wise",
    accountTypeCryptoName: "加密资产",
    accountTypeExchangeName: "交易所",
    accountTypeAlipayName: "支付宝",
    accountTypeWechatName: "微信",
    accountTypeRestrictedName: "受限资金",
    accountTo: "入账账户",
    transferMode: "转账类型",
    currency: "币种",
    fxRateOptional: "汇率（可选）",
    amount: "金额",
    amountWheel: "金额滚轮",
    quickDateHint: "默认使用支付日期",
    quickDateToggle: "日期",
    quickDateYesterday: "昨天",
    quickDateDayBefore: "前天",
    quickUnassignedHint: "未选择账户，将记入未分配账户。",
    note: "备注",
    tagsLabel: "标签",
    saveExpense: "保存支出",
    saveIncome: "保存收入",
    saveTransfer: "保存转账",
    budgetEditor: "预算编辑",
    totalAmount: "预算总额",
    saveBudget: "保存预算",
    settings: "⚙️ 设置",
    navBackSettings: "‹ 设置",
    userId: "用户 ID",
    language: "语言",
    baseCurrency: "基准货币",
    currencyDisplay: "货币显示",
    currencyDisplayCode: "代码（USD）",
    currencyDisplaySymbol: "符号（$）",
    topCurrencyToggleHint: "选择基准货币",
    heroCurrencyToggleHint: "点击净资产币种可切换代码/符号显示",
    hideAmounts: "隐藏金额",
    showAmounts: "显示金额",
    theme: "主题",
    themeSystem: "跟随系统",
    themeLight: "浅色",
    themeDark: "深色",
    themeAurora: "极光渐变",
    timezone: "时区",
    saveSettings: "保存设置",
    general: "通用",
    advancedInsights: "高级洞察",
    showCashFlow: "现金流脉冲",
    showTrend: "支出曲线",
    showRisk: "风险指标",
    showRecentExpenses: "最近交易卡片",
    showToday: "今日卡片",
    showRecentCompare: "最近三日卡片",
    showAccounts: "账户卡片",
    showDebug: "调试面板",
    logout: "退出登录",
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
    navBudget: "预算",
    navAccounts: "账户管理",
    navReview: "月度回顾",
    navCategories: "分类管理",
    navAgentAccess: "Agent 接入",
    budgetPanelTitle: "预算",
    reviewSummaryHeading: "总览",
    reviewExpenseBreakdown: "支出结构",
    reviewTopExpenses: "最高支出",
    refresh: "刷新",
    dashboardWidgets: "首页卡片显示",
    showOnDashboard: "显示在首页",
    addL1Bottom: "✏️ 新增一级分类",
    addCategory: "新增分类",
    addL2Inline: "＋",
    addL2Action: "新增标签",
    emptyNoL2Categories: "暂无二级分类",
    promptL1Name: "输入新的一级分类名称",
    promptL2Name: "为 {l1} 输入新的标签（L2）",
    categoryPromptTitleL1: "新增一级分类",
    categoryPromptTitleL2: "在 {l1} 下新增标签",
    categoryPromptTitleEditL1: "编辑分类 {l1}",
    categoryPromptEmojiLabel: "表情",
    categoryPromptNameLabelL1: "一级分类名称",
    categoryPromptNameLabelL2: "标签名称",
    categoryPromptParentLabel: "所属一级分类",
    categoryPromptSaveL1: "创建一级分类",
    categoryPromptSaveL2: "创建标签",
    categoryPromptSaveEditL1: "保存分类",
    categoryPromptEmojiPlaceholder: "✨",
    categoryPromptNamePlaceholderL1: "例如：Family",
    categoryPromptNamePlaceholderL2: "例如：Gifts",
    editCategoryL1Action: "编辑分类 {l1}",
    confirmDeleteL2: "确定要删除「{l1}」下的标签「{l2}」吗？",
    deleteTagAction: "删除标签 {l2}",
    categoryL1Created: "一级分类已创建",
    categoryL1Updated: "一级分类已更新",
    categoryL2Created: "标签已创建",
    categoryL2Deleted: "标签已删除",
    agentAccess: "🤖 Agent 接入",
    backToDashboard: "返回总览",
    back: "返回",
    edit: "编辑",
    editTransaction: "编辑交易",
    transactionDetailTitle: "交易详情",
    transactionDetailAmount: "金额",
    transactionDetailCategory: "分类",
    transactionDetailAccount: "账户",
    transactionDetailTime: "时间",
    transactionDetailCreatedAt: "创建于 {time}",
    saveTransaction: "保存交易",
    deleteTransaction: "删除交易",
    transactionDeleteConfirm: "确认删除该交易？删除后不可恢复。",
    transactionUpdated: "交易已更新",
    transactionDeleted: "交易已删除",
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
    emptyNoExpenseMonth: "本月暂无消费记录。",
    emptyNoExpenseToday: "今天暂无支出。",
    emptyNoRecentExpense: "暂无交易记录。",
    txFilterTagPlaceholder: "按标签筛选...",
    txFilterAllTypes: "全部类型",
    txFilterAllCategories: "全部分类",
    txFilterStartDate: "开始日期",
    txFilterEndDate: "结束日期",
    txFilterApply: "筛选",
    txFilterReset: "重置",
    recentSpendToday: "今天",
    recentSpendYesterday: "昨天",
    recentSpendDayBefore: "前天",
    emptyNoMonthlyBudget: "暂无月度预算。",
    emptyNoYearlyBudget: "暂无年度预算。",
    emptyNoQuickBudget: "还没有预算数据。",
    recentCompareTitle: "📉 支出变化",
    recentCompareSummaryQuiet: "过去 7 天没有明显支出波动。",
    recentCompareSummaryDown: "过去 7 天共支出 {amount} {currency}，较上周下降 {pct}。",
    recentCompareSummaryUp: "过去 7 天共支出 {amount} {currency}，较上周上升 {pct}。",
    recentCompareSummaryFlat: "过去 7 天共支出 {amount} {currency}，与上周基本持平。",
    recentCompareSummaryEarlyNoBaseline: "本周截至目前共支出 {amount} {currency}，上周{weekday}无可比样本。",
    recentCompareSummaryEarlyDown: "本周截至目前共支出 {amount} {currency}，今日较上周{weekday}下降 {pct}。",
    recentCompareSummaryEarlyUp: "本周截至目前共支出 {amount} {currency}，今日较上周{weekday}上升 {pct}。",
    recentCompareSummaryEarlyFlat: "本周截至目前共支出 {amount} {currency}，今日与上周{weekday}基本持平。",
    recentCompareSummaryAvgDown: "本周截至目前共支出 {amount} {currency}，日均较上周下降 {pct}。",
    recentCompareSummaryAvgUp: "本周截至目前共支出 {amount} {currency}，日均较上周上升 {pct}。",
    recentCompareSummaryAvgFlat: "本周截至目前共支出 {amount} {currency}，日均与上周基本持平。",
    recentCompareSummaryAvgInsufficient: "本周截至目前共支出 {amount} {currency}，上周样本不足，先继续观察。",
    recentCompareSummaryInsufficient: "过去 7 天共支出 {amount} {currency}，上周样本不足，先继续观察。",
    recentCompareSummaryNoBaseline: "过去 7 天共支出 {amount} {currency}，上周同期无支出。",
    recentCompareStateQuiet: "平稳",
    recentCompareStateDown: "回落中",
    recentCompareStateUp: "偏高",
    recentCompareStateFlat: "稳定",
    recentCompareStateInsufficient: "样本不足",
    recentCompareAxisMon: "周一",
    recentCompareAxisTue: "周二",
    recentCompareAxisWed: "周三",
    recentCompareAxisThu: "周四",
    recentCompareAxisFri: "周五",
    recentCompareAxisSat: "周六",
    recentCompareAxisSun: "周日",
    relativeToday: "今天",
    relativeDayAgo: "{days}天前",
    relativeDaysAgo: "{days}天前",
    remaining: "剩余",
    original: "原始",
    reason: "原因",
    from: "转出",
    to: "转入",
    loadedUser: "已加载用户 {id}",
    settingsUpdated: "设置已更新",
    budgetUpdated: "预算已更新",
    accountCreated: "账户已创建",
    transactionCreated: "交易已创建",
    monthlyBudgetSaved: "月度预算已保存",
    yearlyBudgetSaved: "年度预算已保存",
    monthlyReviewGenerated: "月度回顾快照已生成",
    accountNotFound: "未找到账户",
    transactionNotFound: "未找到交易",
    invalidTransactionId: "无效的交易 ID",
    expenseSaved: "支出已保存",
    maxSpendHint: "上限：{amount} {currency}",
    amountExceeded: "金额超过账户可用余额（{amount} {currency}）。",
    invalidAmount: "请输入有效金额。",
    txTypeExpense: "支出",
    txTypeIncome: "收入",
    txTypeTransfer: "转账",
    transferReasonNormal: "内部转账",
    transferReasonLoan: "借出",
    transferReasonBorrow: "借入",
    transferReasonDepositLock: "押金锁定",
    transferReasonDepositRelease: "押金释放",
    agentTokensTitle: "Agent API Token",
    agentTokensHint: "为你的自有 agent 创建 token。明文只会在弹窗中展示一次。",
    agentAccessFlowHint: "点击右上角 + Token，创建后可选择：仅复制 Token，或复制完整接入指令。",
    agentTokenName: "Token 名称",
    createAgentToken: "创建 Token",
    agentTokenCreateSheetTitle: "创建 Agent Token",
    agentTokenCreateSheetHint: "先填一个好记的名称。创建成功后会给你两个复制选项，适合新手直接使用。",
    latestAgentToken: "最近创建的 Token（仅展示一次）",
    agentTokenRevealTitle: "Token 已创建",
    agentTokenRevealHint: "",
    agentTokenRevealOptionToken: "选项 B · 仅复制 Token（界面不展示明文）",
    agentTokenRevealOptionSetup: "点击“复制完整接入说明”，将内容粘贴并贴给你的AI代理，完成AI代理接入（简易）",
    tokenCopied: "Token 已复制",
    tokenCopyMissing: "没有可复制的 Token",
    agentTokenCreated: "Agent token 已创建",
    agentTokenRevoked: "Agent token 已吊销",
    copyToken: "复制",
    copyTokenOnly: "复制 Token",
    copyAgentSetupWithToken: "复制完整接入说明",
    agentSetupWithTokenCopied: "完整接入说明已复制",
    agentQuickstartTitle: "Agent 快速接入",
    agentQuickstartHint: "一键复制给其他 agent 的接入指令（含 skill 下载与调用示例）。",
    copyAgentSetup: "复制接入指令",
    agentSetupCopied: "接入指令已复制",
    revokeToken: "吊销",
    tokenScopes: "权限",
    tokenLastUsed: "最近使用",
    tokenNeverUsed: "从未",
    tokenStatusActive: "生效中",
    tokenStatusRevoked: "已吊销",
    tokenListEmpty: "暂无 agent token。"
  }
};

const FX_QUOTE_CACHE = new Map();
const AUTH_RESEND_COOLDOWN_SECONDS = 60;
const TOPBAR_COMPACT_SCROLL_Y = 56;
const UI_STATE_VERSION = 3;
const MONEY_FORMATTER = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});
let quickEntryLimitReqSeq = 0;
let authResendTimer = null;
let topbarCompactRaf = 0;
let recentCompareChartRaf = 0;
const systemThemeMedia = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

const $ = (selector) => document.querySelector(selector);

function formatTopbarMonth(monthValue) {
  const value = String(monthValue || "").trim();
  const matched = /^(\d{4})-(\d{2})$/.exec(value);
  if (matched) return `${matched[1]}/${matched[2]}`;
  const fallback = new Date().toISOString().slice(0, 7);
  return fallback.replace("-", "/");
}

function updateTopbarMonthDisplay(monthValue = state.month) {
  const monthDisplay = $("#monthDisplayText");
  if (!monthDisplay) return;
  monthDisplay.textContent = formatTopbarMonth(monthValue);
}

document.addEventListener("DOMContentLoaded", () => {
  state.month = new Date().toISOString().slice(0, 7);
  $("#monthInput").value = state.month;
  updateTopbarMonthDisplay(state.month);
  applyTheme("light");
  loadQuickEntryPreferences();
  bindUI();
  initializeDebugCapture();
  initializeQuickEntryDefaults();
  void initializeAuthFlow();
});

function bindUI() {
  $("#reloadBtn").addEventListener("click", async () => {
    syncControlState();
    await loadAll();
  });
  const authGateForm = $("#authGateForm");
  if (authGateForm) {
    authGateForm.addEventListener("submit", submitAuthGateForm);
  }
  const authResendBtn = $("#authResendBtn");
  if (authResendBtn) {
    authResendBtn.addEventListener("click", () => {
      void resendAuthCode();
    });
  }
  const quickLogoutBtn = $("#quickLogoutBtn");
  if (quickLogoutBtn) {
    quickLogoutBtn.addEventListener("click", () => {
      void logoutCurrentSession();
    });
  }
  const onboardingStep1Form = $("#onboardingStep1Form");
  if (onboardingStep1Form) {
    onboardingStep1Form.addEventListener("submit", submitOnboardingStep1Form);
  }
  const onboardingAccountForm = $("#onboardingAccountForm");
  if (onboardingAccountForm) {
    onboardingAccountForm.addEventListener("submit", submitOnboardingAccountForm);
  }
  const onboardingAddL1Btn = $("#onboardingAddL1Btn");
  if (onboardingAddL1Btn) {
    onboardingAddL1Btn.addEventListener("click", () => {
      void addOnboardingL1Category();
    });
  }
  const onboardingAddL2Btn = $("#onboardingAddL2Btn");
  if (onboardingAddL2Btn) {
    onboardingAddL2Btn.addEventListener("click", () => {
      void addOnboardingL2Category();
    });
  }
  const onboardingStep2ContinueBtn = $("#onboardingStep2ContinueBtn");
  if (onboardingStep2ContinueBtn) {
    onboardingStep2ContinueBtn.addEventListener("click", () => {
      void submitOnboardingStep2();
    });
  }
  for (const input of document.querySelectorAll("input[name=onboarding_agent_choice]")) {
    input.addEventListener("change", () => {
      const checked = document.querySelector("input[name=onboarding_agent_choice]:checked");
      const nextChoice = checked instanceof HTMLInputElement ? checked.value : "";
      state.onboarding.agentChoice = nextChoice;
      void finishOnboarding({ openAgentAccess: nextChoice === "yes" });
    });
  }
  window.addEventListener("focus", () => {
    if (state.auth.authenticated) return;
    void resumeSessionIfAvailable();
  });
  window.addEventListener("scroll", scheduleTopbarCompactSync, { passive: true });
  window.addEventListener("resize", scheduleTopbarCompactSync);
  window.addEventListener("resize", scheduleRecentCompareChartSync, { passive: true });
  window.addEventListener("orientationchange", scheduleRecentCompareChartSync, { passive: true });
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", scheduleRecentCompareChartSync, { passive: true });
  }
  $("#monthInput").addEventListener("change", async () => {
    syncControlState();
    await loadAll();
  });
  const heroCompositionLabel = $("#heroCompositionLabel");
  if (heroCompositionLabel) {
    heroCompositionLabel.addEventListener("click", () => {
      toggleHeroCompositionLegendMode();
    });
    heroCompositionLabel.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      toggleHeroCompositionLegendMode();
    });
  }
  const heroPrivacyToggleBtn = $("#heroPrivacyToggleBtn");
  if (heroPrivacyToggleBtn) {
    heroPrivacyToggleBtn.addEventListener("click", () => {
      toggleAmountPrivacyVisibility();
    });
  }
  const topBaseCurrencySelect = $("#topBaseCurrencySelect");
  if (topBaseCurrencySelect instanceof HTMLSelectElement) {
    topBaseCurrencySelect.addEventListener("change", async (event) => {
      const select = event.currentTarget;
      if (!(select instanceof HTMLSelectElement)) return;
      await switchTopBaseCurrency(select.value);
    });
  }
  const heroNetWorthValue = $("#heroNetWorthValue");
  if (heroNetWorthValue) {
    heroNetWorthValue.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target.closest(".hero-value-unit-toggle") : null;
      if (!target) return;
      void toggleTopCurrencyDisplayMode();
    });
    heroNetWorthValue.addEventListener("keydown", (event) => {
      const target = event.target instanceof Element ? event.target.closest(".hero-value-unit-toggle") : null;
      if (!target) return;
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      void toggleTopCurrencyDisplayMode();
    });
  }
  const transactionFilterForm = $("#transactionFilterForm");
  if (transactionFilterForm instanceof HTMLFormElement) {
    transactionFilterForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      syncTransactionFiltersFromInputs();
      await loadTransactions();
    });
  }
  const resetTxFilterBtn = $("#resetTxFilterBtn");
  if (resetTxFilterBtn) {
    resetTxFilterBtn.addEventListener("click", async () => {
      resetTransactionFilters();
      await loadTransactions();
    });
  }
  for (const tab of document.querySelectorAll(".tab")) {
    tab.addEventListener("click", () => switchPanel(tab.dataset.panel));
  }
  $("#accountForm").addEventListener("submit", submitAccountForm);
  $("#transactionForm").addEventListener("submit", submitTransactionForm);
  $("#budgetForm").addEventListener("submit", submitBudgetForm);
  $("#yearlyBudgetForm").addEventListener("submit", submitYearlyBudgetForm);
  const l1Form = $("#l1Form");
  if (l1Form) l1Form.addEventListener("submit", submitL1Form);
  const l2Form = $("#l2Form");
  if (l2Form) l2Form.addEventListener("submit", submitL2Form);
  const settingsForm = $("#settingsForm");
  if (settingsForm) settingsForm.addEventListener("submit", submitSettingsForm);
  const agentTokenForm = $("#agentTokenForm");
  if (agentTokenForm) agentTokenForm.addEventListener("submit", submitAgentTokenForm);
  const agentTokenRevealCopyBtn = $("#agentTokenRevealCopyBtn");
  if (agentTokenRevealCopyBtn) {
    agentTokenRevealCopyBtn.addEventListener("click", () => {
      void copyLatestAgentToken();
    });
  }
  const agentTokenRevealCopySetupBtn = $("#agentTokenRevealCopySetupBtn");
  if (agentTokenRevealCopySetupBtn) {
    agentTokenRevealCopySetupBtn.addEventListener("click", () => {
      void copyLatestAgentSetupGuide();
    });
  }
  const agentQuickstartCopyBtn = $("#agentQuickstartCopyBtn");
  if (agentQuickstartCopyBtn) {
    agentQuickstartCopyBtn.addEventListener("click", () => {
      void copyAgentSetupGuide();
    });
  }
  $("#generateReviewBtn").addEventListener("click", generateMonthlyReview);
  $("#transactionForm [name=type]").addEventListener("change", handleTxTypeChange);
  $("#transactionForm [name=transfer_reason]").addEventListener("change", handleTxTypeChange);
  $("#transactionForm [name=category_l1]").addEventListener("change", populateL2Select);
  $("#transactionEditForm [name=category_l1]").addEventListener("change", populateTransactionEditL2Select);
  $("#transactionEditForm [name=type]").addEventListener("change", handleTransactionEditTypeChange);
  $("#transactionEditForm [name=transfer_reason]").addEventListener("change", handleTransactionEditTypeChange);
  $("#openQuickAddBtn").addEventListener("click", () => openSheet("quickEntrySheet"));
  $("#openSettingsBtn").addEventListener("click", () => openSheet("settingsSheet"));
  const budgetBtn = $("#openBudgetSheetBtn");
  if (budgetBtn) {
    budgetBtn.addEventListener("click", () => {
      const monthInput = $("#quickBudgetForm [name=month]");
      if (monthInput) monthInput.value = state.month;
      openSheet("budgetSheet", { preserveUtility: true });
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
  const toggleRecent = $("#toggleRecentExpenses");
  if (toggleRecent) {
    toggleRecent.addEventListener("change", () => {
      state.ui.showRecentExpenses = toggleRecent.checked;
      persistUiState();
      applyAdvancedVisibility();
    });
  }
  const toggleToday = $("#toggleToday");
  if (toggleToday) {
    toggleToday.addEventListener("change", () => {
      state.ui.showToday = toggleToday.checked;
      persistUiState();
      applyAdvancedVisibility();
    });
  }
  const toggleRecentCompare = $("#toggleRecentCompare");
  if (toggleRecentCompare) {
    toggleRecentCompare.addEventListener("change", () => {
      state.ui.showRecentCompare = toggleRecentCompare.checked;
      persistUiState();
      applyAdvancedVisibility();
      scheduleRecentCompareChartSync();
    });
  }
  const toggleAccounts = $("#toggleAccounts");
  if (toggleAccounts) {
    toggleAccounts.addEventListener("change", () => {
      state.ui.showAccounts = toggleAccounts.checked;
      persistUiState();
      applyAdvancedVisibility();
    });
  }
  const budgetViewTabs = document.getElementById("budgetViewTabs");
  if (budgetViewTabs) {
    budgetViewTabs.addEventListener("click", (event) => {
      if (!(event.target instanceof Element)) return;
      const btn = event.target.closest(".acct-period-btn");
      if (!btn) return;
      const view = btn.dataset.view;
      if (!view) return;
      state.ui.budgetPieView = view === "pie";
      persistUiState();
      if (state.dashboard) renderPlannedBudgetCard(state.dashboard);
    });
  }
  for (const btn of document.querySelectorAll("[data-quick-type]")) {
    btn.addEventListener("click", () => {
      const type = String(btn.getAttribute("data-quick-type") || "expense");
      setQuickEntryType(type);
    });
  }
  const quickL1Grid = $("#quickL1Grid");
  if (quickL1Grid) {
    quickL1Grid.addEventListener("click", (event) => {
      if (!(event.target instanceof Element)) return;
      const optionBtn = event.target.closest("button[data-l1]");
      if (!optionBtn) return;
      const encoded = String(optionBtn.getAttribute("data-l1") || "");
      const value = decodeURIComponent(encoded || "");
      const select = $("#quickEntryForm [name=category_l1]");
      if (!select) return;
      select.value = value;
      populateQuickEntryL2();
    });
  }
  const quickL2Grid = $("#quickL2Grid");
  if (quickL2Grid) {
    quickL2Grid.addEventListener("click", (event) => {
      if (!(event.target instanceof Element)) return;
      const optionBtn = event.target.closest("button[data-l2]");
      if (!optionBtn) return;
      const encoded = String(optionBtn.getAttribute("data-l2") || "");
      const value = decodeURIComponent(encoded || "");
      const select = $("#quickEntryForm [name=category_l2]");
      if (!select) return;
      select.value = value;
      void updateQuickEntryFlow();
      renderQuickL2Grid();
    });
  }
  const quickTransferReasonGrid = $("#quickTransferReasonGrid");
  if (quickTransferReasonGrid) {
    quickTransferReasonGrid.addEventListener("click", (event) => {
      if (!(event.target instanceof Element)) return;
      const optionBtn = event.target.closest("button[data-transfer-reason]");
      if (!optionBtn) return;
      const value = String(optionBtn.getAttribute("data-transfer-reason") || "normal");
      const select = $("#quickEntryForm [name=transfer_reason]");
      if (!(select instanceof HTMLSelectElement)) return;
      select.value = value;
      rememberQuickEntryPreferences();
      renderQuickTransferReasonGrid();
      void updateQuickEntryFlow();
    });
  }
  $("#quickEntryForm [name=category_l1]").addEventListener("change", () => {
    populateQuickEntryL2();
  });
  $("#quickEntryForm [name=category_l2]").addEventListener("change", () => {
    void updateQuickEntryFlow();
  });
  $("#quickEntryForm [name=account_from_id]").addEventListener("change", () => {
    rememberQuickEntryPreferences();
    void updateQuickEntryFlow();
  });
  $("#quickEntryForm [name=account_to_id]").addEventListener("change", () => {
    rememberQuickEntryPreferences();
    void updateQuickEntryFlow();
  });
  $("#quickEntryForm [name=currency_original]").addEventListener("change", () => {
    rememberQuickEntryPreferences();
    void updateQuickEntryFlow();
  });
  $("#quickEntryForm [name=transfer_reason]").addEventListener("change", () => {
    rememberQuickEntryPreferences();
    renderQuickTransferReasonGrid();
    void updateQuickEntryFlow();
  });
  const quickDateInput = $("#quickEntryForm [name=date]");
  if (quickDateInput) {
    const syncQuickDate = () => updateQuickDateDisplay();
    quickDateInput.addEventListener("change", syncQuickDate);
    quickDateInput.addEventListener("input", syncQuickDate);
  }
  const quickDateToggleBtn = $("#quickDateToggleBtn");
  if (quickDateToggleBtn) {
    quickDateToggleBtn.addEventListener("click", () => {
      const dateInput = $("#quickEntryForm [name=date]");
      if (dateInput && typeof dateInput.showPicker === "function") {
        dateInput.showPicker();
        return;
      }
      const wrap = $("#quickDateWrap");
      if (!wrap) return;
      const nextHidden = !wrap.classList.contains("hidden");
      wrap.classList.toggle("hidden", nextHidden);
      if (!nextHidden && dateInput) dateInput.focus();
    });
  }
  $("#quickBudgetForm").addEventListener("submit", submitQuickBudgetForm);
  $("#quickSettingsForm").addEventListener("submit", submitQuickSettingsForm);
  $("#accountEditForm").addEventListener("submit", submitAccountEditForm);
  $("#budgetEditForm").addEventListener("submit", submitBudgetEditForm);
  // Budget list click delegation (monthly + yearly)
  for (const listId of ["budgetList", "yearlyBudgetList"]) {
    const list = document.getElementById(listId);
    if (list) list.addEventListener("click", (event) => {
      if (!(event.target instanceof Element)) return;
      const row = event.target.closest("[data-action='edit-budget']");
      if (!row) return;
      openBudgetEditSheet(
        String(row.getAttribute("data-scope") || "monthly"),
        String(row.getAttribute("data-period") || ""),
        String(row.getAttribute("data-category") || ""),
        Number(row.getAttribute("data-amount") || 0)
      );
    });
  }
  $("#transactionEditForm").addEventListener("submit", submitTransactionEditForm);
  $("#accountDeleteBtn").addEventListener("click", deleteCurrentAccount);
  $("#accountForceDeleteBtn").addEventListener("click", forceDeleteCurrentAccount);
  const transactionDeleteBtn = $("#transactionDeleteBtn");
  if (transactionDeleteBtn) {
    transactionDeleteBtn.addEventListener("click", deleteCurrentTransaction);
  }
  $("#transactionDetailEditBtn").addEventListener("click", openCurrentDetailForEdit);
  $("#transactionDetailDeleteBtn").addEventListener("click", deleteCurrentDetailTransaction);
  const recentExpensesTitle = $("#recentExpensesTitle");
  if (recentExpensesTitle) {
    recentExpensesTitle.addEventListener("click", () => {
      void openTransactionRecordsPanel();
    });
  }
  const categoryTree = $("#categoryTree");
  if (categoryTree) {
    categoryTree.addEventListener("click", (event) => {
      if (!(event.target instanceof Element)) return;
      const editBtn = event.target.closest("button[data-action='edit-l1']");
      if (editBtn) {
        const encodedL1 = String(editBtn.getAttribute("data-l1") || "");
        const l1Name = decodeURIComponent(encodedL1 || "").trim();
        if (!l1Name) return;
        openCategoryPrompt("edit_l1", l1Name);
        return;
      }
      const addBtn = event.target.closest("button[data-action='add-l2']");
      if (addBtn) {
        const l1Name = String(addBtn.getAttribute("data-l1") || "").trim();
        if (!l1Name) return;
        void createL2CategoryInline(l1Name);
        return;
      }
      const deleteBtn = event.target.closest("button[data-action='delete-l2']");
      if (deleteBtn) {
        const encodedL1 = String(deleteBtn.getAttribute("data-l1") || "");
        const encodedL2 = String(deleteBtn.getAttribute("data-l2") || "");
        const l1Name = decodeURIComponent(encodedL1 || "").trim();
        const l2Name = decodeURIComponent(encodedL2 || "").trim();
        if (!l1Name || !l2Name) return;
        void deleteL2CategoryInline(l1Name, l2Name);
        return;
      }
      const isTouchLike =
        typeof window.matchMedia === "function" && window.matchMedia("(hover: none)").matches;
      const tagItem = event.target.closest(".category-tag-item");
      if (isTouchLike && tagItem) {
        const shouldReveal = !tagItem.classList.contains("reveal-delete");
        categoryTree.querySelectorAll(".category-tag-item.reveal-delete").forEach((node) => {
          if (node !== tagItem) node.classList.remove("reveal-delete");
        });
        tagItem.classList.toggle("reveal-delete", shouldReveal);
        return;
      }
      categoryTree.querySelectorAll(".category-tag-item.reveal-delete").forEach((node) => {
        node.classList.remove("reveal-delete");
      });
    });
  }
  const addL1BottomBtn = $("#addL1BottomBtn");
  if (addL1BottomBtn) {
    addL1BottomBtn.addEventListener("click", () => {
      void createL1CategoryInline();
    });
  }
  const categoryPromptForm = $("#categoryPromptForm");
  if (categoryPromptForm) {
    categoryPromptForm.addEventListener("submit", submitCategoryPromptForm);
  }
  $("#accountList").addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const row = event.target.closest("[data-action='edit-account']");
    if (!row) return;
    const id = Number(row.getAttribute("data-id"));
    if (!Number.isInteger(id) || id <= 0) return;
    openAccountEditSheet(id);
  });
  $("#transactionList").addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const row = event.target.closest("article[data-tx-id]");
    if (!row) return;
    const id = Number(row.getAttribute("data-tx-id"));
    if (!Number.isInteger(id) || id <= 0) return;
    openTransactionDetailSheet(id);
  });
  const acctPeriodTabs = document.getElementById("acctPeriodTabs");
  if (acctPeriodTabs) {
    acctPeriodTabs.addEventListener("click", (event) => {
      if (!(event.target instanceof Element)) return;
      const btn = event.target.closest(".acct-period-btn");
      if (!btn) return;
      event.stopPropagation();
      const period = btn.dataset.period;
      if (period && period !== state.accountPeriod) loadAccountPeriodTxs(period);
    });
  }
  const dashAccountsTitle = document.getElementById("dashboardAccountsTitle");
  if (dashAccountsTitle) {
    dashAccountsTitle.addEventListener("click", () => {
      openUtilityPanel("accountsPanel");
      const panel = document.getElementById("accountsPanel");
      if (panel) {
        panel.classList.add("panel-entering");
        panel.addEventListener("animationend", () => panel.classList.remove("panel-entering"), { once: true });
      }
    });
  }
  const dashAccountsListEl = document.getElementById("dashboardAccountsList");
  if (dashAccountsListEl) {
    dashAccountsListEl.addEventListener("click", (event) => {
      if (!(event.target instanceof Element)) return;
      const row = event.target.closest("[data-action='edit-account']");
      if (!row) return;
      const id = Number(row.getAttribute("data-id"));
      if (!Number.isInteger(id) || id <= 0) return;
      openAccountEditSheet(id);
    });
  }
  const budgetPlanTitleBtn = document.getElementById("budgetPlanTitle");
  if (budgetPlanTitleBtn) {
    budgetPlanTitleBtn.addEventListener("click", () => {
      openUtilityPanel("budgetsPanel");
      const panel = document.getElementById("budgetsPanel");
      if (panel) {
        panel.classList.add("panel-entering");
        panel.addEventListener("animationend", () => panel.classList.remove("panel-entering"), { once: true });
      }
    });
  }
  const budgetPlanListEl = document.getElementById("budgetPlanList");
  if (budgetPlanListEl) {
    budgetPlanListEl.addEventListener("click", (event) => {
      if (!(event.target instanceof Element)) return;
      const row = event.target.closest("[data-action='edit-budget']");
      if (!row) return;
      openBudgetEditSheet(
        String(row.getAttribute("data-scope") || "monthly"),
        String(row.getAttribute("data-period") || ""),
        String(row.getAttribute("data-category") || ""),
        Number(row.getAttribute("data-amount") || 0)
      );
    });
  }
  $("#recentExpensesList").addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const row = event.target.closest("article[data-tx-id]");
    if (!row) return;
    const id = Number(row.getAttribute("data-tx-id"));
    if (!Number.isInteger(id) || id <= 0) return;
    openTransactionDetailSheet(id);
  });
  const todayExpensesListEl = document.getElementById("todayExpensesList");
  if (todayExpensesListEl) {
    todayExpensesListEl.addEventListener("click", (event) => {
      if (!(event.target instanceof Element)) return;
      const row = event.target.closest("article[data-tx-id]");
      if (!row) return;
      const id = Number(row.getAttribute("data-tx-id"));
      if (!Number.isInteger(id) || id <= 0) return;
      openTransactionDetailSheet(id);
    });
  }
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
  closeTransactionRecordsOnlyMode();

  const agentTokenList = $("#agentTokenList");
  if (agentTokenList) {
    agentTokenList.addEventListener("click", async (event) => {
      if (!(event.target instanceof Element)) return;
      const btn = event.target.closest("button[data-action]");
      if (!btn) return;
      const tokenId = Number(btn.getAttribute("data-id"));
      if (!Number.isInteger(tokenId) || tokenId <= 0) return;
      const action = String(btn.getAttribute("data-action") || "");
      try {
        if (action === "revoke") {
          await api(`/api/v1/auth/agent-tokens/${tokenId}`, { method: "DELETE" });
          showToast(t("agentTokenRevoked"));
          await loadAgentTokens();
        }
      } catch (error) {
        showErrorToast(error);
      }
    });
  }
  updateTopbarCompactState();
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
  updateQuickDateDisplay();
  const budgetMonth = $("#quickBudgetForm [name=month]");
  if (budgetMonth) budgetMonth.value = state.month;
}

function canUseCompactTopbar() {
  const topbar = $("#mainTopbar");
  if (!topbar) return false;
  if (document.body.classList.contains("sheet-open")) return false;
  if (document.body.classList.contains("utility-mode")) return false;
  const dashboardPanel = $("#dashboardPanel");
  return Boolean(dashboardPanel && dashboardPanel.classList.contains("active"));
}

function updateTopbarCompactState() {
  const topbar = $("#mainTopbar");
  if (!topbar) return;
  const shouldCompact = canUseCompactTopbar() && window.scrollY > TOPBAR_COMPACT_SCROLL_Y;
  topbar.classList.toggle("topbar--compact", shouldCompact);
}

function scheduleTopbarCompactSync() {
  if (topbarCompactRaf) return;
  topbarCompactRaf = window.requestAnimationFrame(() => {
    topbarCompactRaf = 0;
    updateTopbarCompactState();
  });
}

function scheduleRecentCompareChartSync() {
  if (recentCompareChartRaf) return;
  recentCompareChartRaf = window.requestAnimationFrame(() => {
    recentCompareChartRaf = 0;
    const chartEl = $("#recentCompareChart");
    const cardEl = $("#recentCompareCard");
    if (!(chartEl instanceof SVGElement)) return;
    if (cardEl && cardEl.classList.contains("hidden")) return;
    renderRecentCompareCard(state.recentCompareRows || []);
  });
}

function switchPanel(id) {
  if (id !== "transactionsPanel") {
    closeTransactionRecordsOnlyMode();
  }
  for (const tab of document.querySelectorAll(".tab")) {
    tab.classList.toggle("active", tab.dataset.panel === id);
  }
  for (const panel of document.querySelectorAll(".panel")) {
    panel.classList.toggle("active", panel.id === id);
  }
  scheduleTopbarCompactSync();
}

function setTransactionRecordsOnlyMode(enabled) {
  const panel = $("#transactionsPanel");
  if (!panel) return;
  panel.classList.toggle("records-only", Boolean(enabled));
}

function isTransactionRecordsOnlyMode() {
  const panel = $("#transactionsPanel");
  return Boolean(panel && panel.classList.contains("records-only"));
}

function closeTransactionRecordsOnlyMode() {
  setTransactionRecordsOnlyMode(false);
}

async function openTransactionRecordsPanel() {
  resetTransactionFilters();
  setTransactionRecordsOnlyMode(true);
  openUtilityPanel("transactionsPanel");
  try {
    await loadTransactions({ expenseOnly: false });
  } catch (error) {
    showErrorToast(error);
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
    if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);
    updateQuickDateDisplay();
    const dateWrap = $("#quickDateWrap");
    if (dateWrap) dateWrap.classList.add("hidden");
    const amountInput = $("#quickEntryForm [name=amount_original]");
    if (amountInput) amountInput.value = "0";
    syncQuickAmountDisplay(0);
    setQuickEntryType(state.quickEntryType || "expense");
    void updateQuickEntryFlow();
  }
  if (id === "budgetSheet") {
    const monthInput = $("#quickBudgetForm [name=month]");
    if (monthInput) monthInput.value = state.month;
  }
  if (id === "settingsSheet") {
    const userInput = $("#quickSettingsForm [name=user_id]");
    if (userInput) userInput.value = String(state.userId);
    $("#quickSettingsForm [name=ui_language]").value = ensureUILanguage(state.settings?.ui_language || "en");
    syncDevBypassVisibility();
    showSettingsPage("settingsPageMain", "back");
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
  if (id === "settingsSheet") {
    state.widgetsOpenedFromDashboard = false;
  }
  if (id === "transactionDetailSheet") {
    state.detailTransactionId = null;
  }
  syncSheetOpenState();
}

function closeAllSheets() {
  for (const sheet of document.querySelectorAll(".sheet")) {
    sheet.classList.add("hidden");
    sheet.setAttribute("aria-hidden", "true");
  }
  state.detailTransactionId = null;
  syncSheetOpenState();
}

function syncSheetOpenState() {
  const anyOpen = Array.from(document.querySelectorAll(".sheet")).some(
    (sheet) => !sheet.classList.contains("hidden")
  );
  document.body.classList.toggle("sheet-open", anyOpen);
  scheduleTopbarCompactSync();
}

function openUtilityPanel(panelId) {
  closeAllSheets();
  const panel = document.getElementById(panelId);
  if (!panel) return;
  if (panelId !== "transactionsPanel") {
    closeTransactionRecordsOnlyMode();
  }
  document.body.classList.add("utility-mode");
  for (const p of document.querySelectorAll(".panel")) {
    p.classList.remove("utility-open");
    p.classList.toggle("active", p.id === "dashboardPanel");
  }
  panel.classList.add("utility-open");
  panel.classList.add("active");
  $("#closeUtilityBtn").classList.remove("hidden");
  scheduleTopbarCompactSync();
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
  closeTransactionRecordsOnlyMode();
  scheduleTopbarCompactSync();
}

function syncControlState() {
  const uidInput = $("#userIdInput");
  if (state.auth.allowDevBypass && !state.auth.authenticated && uidInput) {
    const uid = Number(uidInput.value || "1");
    state.userId = Number.isInteger(uid) && uid > 0 ? uid : 1;
  }
  state.month = $("#monthInput").value || new Date().toISOString().slice(0, 7);
  updateTopbarMonthDisplay(state.month);
}

async function api(path, init = {}) {
  const method = String(init.method || "GET").toUpperCase();
  const clientRequestId = generateClientRequestId();
  const startedAt = Date.now();
  const headers = {
    "x-client-request-id": clientRequestId,
    ...(init.headers || {})
  };
  if (
    state.auth.allowDevBypass &&
    state.auth.devBypass &&
    !state.auth.authenticated &&
    Number.isInteger(state.userId) &&
    state.userId > 0
  ) {
    headers["x-user-id"] = String(state.userId);
  }
  if (!headers["content-type"] && init.body !== undefined) {
    headers["content-type"] = "application/json";
  }
  let res;
  try {
    res = await fetch(path, { ...init, headers, credentials: "same-origin" });
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
    if (res.status === 401) {
      state.auth.authenticated = false;
      hideOnboardingGate({ keepState: true });
      showAuthGate();
      closeAllSheets();
      closeUtilityPanel();
      showToast(t("authSessionExpired"), true);
    }
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
  return MONEY_FORMATTER.format(Number(value || 0));
}

function isAmountPrivacyEnabled() {
  return Boolean(state.ui.hideSensitiveAmounts);
}

function maskedAmountText(text) {
  return isAmountPrivacyEnabled() ? "••••" : String(text);
}

function formatMoneyMasked(value) {
  return isAmountPrivacyEnabled() ? "••••" : formatMoney(value);
}

function formatSignedMoneyMasked(value) {
  return isAmountPrivacyEnabled() ? "••••" : formatSignedMoney(value);
}

function renderMoneyWithUnit(amountText, currencyText) {
  const amount = String(amountText ?? "").trim();
  const currency = String(currencyText ?? "").trim();
  if (isAmountPrivacyEnabled()) return "••••";
  if (!currency) return `<span class="money-amount">${escapeHtml(amount)}</span>`;
  return `<span class="money-amount">${escapeHtml(amount)}</span><span class="money-unit">${escapeHtml(currency)}</span>`;
}

function formatCurrencyUnitWithMode(value, mode) {
  const code = ensureUICurrency(value || "USD");
  if (mode === "symbol") {
    return CURRENCY_SYMBOL_MAP[code] || code;
  }
  return code;
}

function formatCurrencyUnit(value) {
  const mode = ensureCurrencyDisplayMode(state.settings?.currency_display_mode || "code");
  return formatCurrencyUnitWithMode(value, mode);
}

function syncTopCurrencyModeControl() {
  const select = $("#topBaseCurrencySelect");
  if (!(select instanceof HTMLSelectElement)) return;
  for (const option of Array.from(select.options)) {
    option.textContent = ensureUICurrency(option.value);
  }
  const hint = t("topCurrencyToggleHint") || t("baseCurrency");
  select.setAttribute("title", hint);
  select.setAttribute("aria-label", hint);
}

function syncHeroCompositionToggleControl() {
  const label = $("#heroCompositionLabel");
  if (!label) return;
  const isPercent = Boolean(state.ui.accountCompositionPercent);
  label.classList.add("hero-label-toggleable");
  label.classList.toggle("hero-label-toggleable--percent", isPercent);
  label.setAttribute("role", "button");
  label.setAttribute("tabindex", "0");
  const hint = t("compositionToggleHint");
  label.setAttribute("title", hint);
  label.setAttribute("aria-label", hint);
}

function renderHeroPrivacyToggleControl() {
  const btn = $("#heroPrivacyToggleBtn");
  if (!btn) return;
  const hidden = isAmountPrivacyEnabled();
  const hint = t(hidden ? "showAmounts" : "hideAmounts");
  btn.classList.toggle("active", hidden);
  btn.setAttribute("title", hint);
  btn.setAttribute("aria-label", hint);
  const icon = hidden
    ? `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"></path>
        <circle cx="12" cy="12" r="3"></circle>
        <path d="M4 4l16 16"></path>
      </svg>
    `
    : `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"></path>
        <circle cx="12" cy="12" r="3"></circle>
      </svg>
    `;
  btn.innerHTML = `${icon}<span class="sr-only">${escapeHtml(hint)}</span>`;
}

function resolveCurrencyForDisplay(value, fallback = "USD") {
  const raw = String(value || "").trim().toUpperCase();
  if (UI_CURRENCIES.has(raw)) return raw;
  return ensureUICurrency(fallback || "USD");
}

function formatCompactKMoney(value) {
  const amount = Math.abs(Number(value || 0));
  if (!Number.isFinite(amount) || amount < 0.0001) return "0";
  if (amount >= 1000) return `${formatCompactDecimal(amount / 1000)}k`;
  return formatCompactDecimal(amount);
}

function formatCompactDecimal(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return "0";
  const abs = Math.abs(num);
  const digits = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
  return num
    .toFixed(digits)
    .replace(/\.0+$/, "")
    .replace(/(\.\d*[1-9])0+$/, "$1");
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

async function copyTextToClipboard(text) {
  const value = String(text || "");
  if (!value) return false;
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return true;
  }
  const tmp = document.createElement("textarea");
  tmp.value = value;
  tmp.setAttribute("readonly", "readonly");
  tmp.style.position = "fixed";
  tmp.style.opacity = "0";
  tmp.style.pointerEvents = "none";
  document.body.appendChild(tmp);
  tmp.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(tmp);
  if (!copied) {
    throw new Error("Clipboard copy is not available.");
  }
  return true;
}

function buildAgentSetupGuide(tokenOverride = "") {
  const skillFolderUrl =
    "https://github.com/Uacer/Nomad-Finance-OS/tree/main/skills/nomad-capture-ledger";
  const token = String(tokenOverride || "").trim() || "<PASTE_AGENT_API_TOKEN>";
  const lang = ensureUILanguage(state.settings?.ui_language);

  if (lang === "zh") {
    return [
      "请安装 `nomad-capture-ledger` skill（包含目录内全部文件）：",
      "",
      `- GitHub Skill: ${skillFolderUrl}`,
      `- Agent API Token: ${token}`
    ].join("\n");
  }

  return [
    "Please install the `nomad-capture-ledger` skill (include all files):",
    "",
    `- GitHub Skill: ${skillFolderUrl}`,
    `- Agent API Token: ${token}`
  ].join("\n");
}

async function copyAgentSetupGuide(tokenOverride = "") {
  try {
    const token = String(tokenOverride || "").trim();
    await copyTextToClipboard(buildAgentSetupGuide(token));
    showToast(t(token ? "agentSetupWithTokenCopied" : "agentSetupCopied"));
  } catch (error) {
    showToast(formatErrorForToast(error), true);
  }
}

async function copyLatestAgentSetupGuide() {
  const token = String(state.latestAgentTokenPlaintext || "");
  if (!token.trim()) {
    showToast(t("tokenCopyMissing"), true);
    return;
  }
  await copyAgentSetupGuide(token);
}

function showAgentTokenReveal(token) {
  const value = String(token || "").trim();
  if (value) state.latestAgentTokenPlaintext = value;
  openSheet("agentTokenRevealSheet", { preserveUtility: true });
}

async function copyLatestAgentToken() {
  const token = String(state.latestAgentTokenPlaintext || "");
  if (!token.trim()) {
    showToast(t("tokenCopyMissing"), true);
    return;
  }
  try {
    await copyTextToClipboard(token);
    showToast(t("tokenCopied"));
  } catch (error) {
    showToast(formatErrorForToast(error), true);
  }
}

async function initializeAuthFlow() {
  syncControlState();
  loadUiState();
  applyI18n();
  try {
    await loadAuthSession();
  } catch (error) {
    showToast(formatErrorForToast(error), true);
    showAuthGate();
    return;
  }
  if (!state.auth.authenticated) {
    hideOnboardingGate({ keepState: true });
    showAuthGate();
    return;
  }
  hideAuthGate();
  const onboardingActive = await maybeStartOnboardingFlow();
  if (!onboardingActive) {
    await loadAll();
  }
}

async function loadAuthSession() {
  const response = await fetch("/api/v1/auth/session", {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store"
  });
  const payload = await safeJson(response);
  if (!response.ok) {
    const detail =
      typeof payload?.error === "string"
        ? payload.error
        : payload?.error
          ? JSON.stringify(payload.error)
          : `${response.status} ${response.statusText}`;
    const error = new Error(detail);
    error.status = response.status;
    throw error;
  }
  state.auth.allowDevBypass = Boolean(payload?.allow_dev_bypass);
  state.auth.authenticated = Boolean(payload?.authenticated);
  state.auth.devBypass = Boolean(payload?.dev_bypass);
  state.auth.user = payload?.user || null;
  if (state.auth.authenticated && Number.isInteger(Number(payload?.user?.id))) {
    state.userId = Number(payload.user.id);
    const userInput = $("#userIdInput");
    if (userInput) userInput.value = String(state.userId);
  }
  syncDevBypassVisibility();
  state.auth.ready = true;
  return payload;
}

async function resumeSessionIfAvailable() {
  try {
    await loadAuthSession();
  } catch {
    return;
  }
  if (!state.auth.authenticated) return;
  hideAuthGate();
  const onboardingActive = await maybeStartOnboardingFlow();
  if (!onboardingActive) {
    await loadAll();
  }
}

function showAuthGate() {
  hideOnboardingGate({ keepState: true });
  const gate = $("#authGate");
  if (gate) {
    gate.classList.remove("hidden");
    gate.setAttribute("aria-hidden", "false");
  }
  document.body.classList.add("auth-required");
  renderAuthGate();
  syncDevBypassVisibility();
}

function hideAuthGate() {
  const gate = $("#authGate");
  if (gate) {
    gate.classList.add("hidden");
    gate.setAttribute("aria-hidden", "true");
  }
  document.body.classList.remove("auth-required");
  resetAuthFormState();
}

async function maybeStartOnboardingFlow() {
  let onboardingState;
  try {
    onboardingState = await api("/api/v1/onboarding/state");
  } catch (error) {
    showErrorToast(error);
    hideOnboardingGate({ keepState: true });
    return false;
  }
  state.onboarding.stateLoaded = true;
  state.onboarding.completed = Boolean(onboardingState?.completed);
  state.onboarding.currentStep = normalizeOnboardingStep(onboardingState?.current_step || "step1");
  if (state.onboarding.completed) {
    hideOnboardingGate({ keepState: true });
    return false;
  }
  try {
    await Promise.all([loadSettings(), loadCategories(), loadAccounts()]);
    await initializeOnboardingDraftState();
  } catch (error) {
    showErrorToast(error);
    return false;
  }
  showOnboardingGate();
  return true;
}

function showOnboardingGate() {
  closeAllSheets();
  closeUtilityPanel();
  const gate = $("#onboardingGate");
  if (gate) {
    gate.classList.remove("hidden");
    gate.setAttribute("aria-hidden", "false");
  }
  document.body.classList.add("onboarding-required");
  renderOnboardingGate();
}

function hideOnboardingGate(options = {}) {
  const keepState = Boolean(options.keepState);
  const gate = $("#onboardingGate");
  if (gate) {
    gate.classList.add("hidden");
    gate.setAttribute("aria-hidden", "true");
  }
  document.body.classList.remove("onboarding-required");
  if (!keepState) {
    state.onboarding.step = "step1";
  }
}

async function initializeOnboardingDraftState() {
  state.onboarding.countryCode = ensureOnboardingCountryCode(
    String(state.settings?.living_country_code || DEFAULT_ONBOARDING_COUNTRY_CODE)
  );
  state.onboarding.timezone = String(state.settings?.timezone || "Asia/Shanghai");
  state.onboarding.baseCurrency = ensureUICurrency(state.settings?.base_currency || "USD");
  state.onboarding.incomeBand = ensureOnboardingIncomeBand(state.settings?.monthly_income_band || "8000_20000");
  state.onboarding.currentStep = normalizeOnboardingStep(state.onboarding.currentStep || "step1");
  state.onboarding.step = state.onboarding.currentStep === "completed" ? "step1" : state.onboarding.currentStep;
  state.onboarding.agentChoice = "";
  state.onboarding.finishing = false;

  if (!state.onboarding.timezone || state.onboarding.timezone === "UTC") {
    try {
      const geo = await api("/api/v1/onboarding/geo-suggest");
      if (
        (!state.onboarding.timezone || state.onboarding.timezone === "UTC") &&
        typeof geo?.timezone === "string" &&
        geo.timezone.trim()
      ) {
        state.onboarding.timezone = geo.timezone.trim();
      }
    } catch {
      // best-effort prefill; keep manual values when unavailable
    }
  }

  if (state.onboarding.step === "step2" || state.onboarding.step === "step3") {
    await refreshOnboardingBudgetSuggestion({ preserveExisting: true });
    await ensureOnboardingDefaultAccount();
  }
  renderOnboardingGate();
}

function renderOnboardingGate() {
  const currentStep = normalizeOnboardingStep(state.onboarding.step || "step1");
  const displayStep = currentStep === "step2" ? 2 : currentStep === "step3" ? 3 : 1;
  setText("onboardingProgressText", t("onboardingProgress", { current: String(displayStep) }));

  const step1 = $("#onboardingStep1");
  const step2 = $("#onboardingStep2");
  const step3 = $("#onboardingStep3");
  if (step1) step1.classList.toggle("hidden", currentStep !== "step1");
  if (step2) step2.classList.toggle("hidden", currentStep !== "step2");
  if (step3) step3.classList.toggle("hidden", currentStep !== "step3");

  const countryInput = $("#onboardingCountryInput");
  if (countryInput instanceof HTMLSelectElement) {
    const nextCountry = ensureOnboardingCountryCode(state.onboarding.countryCode || DEFAULT_ONBOARDING_COUNTRY_CODE);
    const hasOption = Array.from(countryInput.options).some((option) => option.value === nextCountry);
    if (!hasOption) {
      countryInput.appendChild(new Option(nextCountry, nextCountry));
    }
    countryInput.value = nextCountry;
  }
  const timezoneInput = $("#onboardingTimezoneInput");
  if (timezoneInput instanceof HTMLInputElement) timezoneInput.value = state.onboarding.timezone || "UTC";
  const baseInput = $("#onboardingBaseCurrencyInput");
  if (baseInput instanceof HTMLSelectElement) baseInput.value = ensureUICurrency(state.onboarding.baseCurrency || "USD");
  const bandInput = $("#onboardingIncomeBandInput");
  if (bandInput instanceof HTMLSelectElement) bandInput.value = ensureOnboardingIncomeBand(state.onboarding.incomeBand);
  const accountCurrency = $("#onboardingAccountCurrencyInput");
  if (accountCurrency instanceof HTMLSelectElement) {
    accountCurrency.value = ensureUICurrency(state.onboarding.baseCurrency || "USD");
  }
  const accountNameInput = $("#onboardingAccountNameInput");
  if (accountNameInput instanceof HTMLInputElement) {
    if (!accountNameInput.value.trim() && (!Array.isArray(state.accounts) || state.accounts.length === 0)) {
      accountNameInput.value = t("onboardingDefaultAccountName");
    }
  }
  renderOnboardingAccounts();
  renderOnboardingCategorySummary();
  renderOnboardingBudgetDraft();
  const yesInput = $("#onboardingHasAgentYes");
  const noInput = $("#onboardingHasAgentNo");
  const choice = state.onboarding.agentChoice === "yes" ? "yes" : state.onboarding.agentChoice === "no" ? "no" : "";
  if (yesInput instanceof HTMLInputElement) {
    yesInput.checked = choice === "yes";
    yesInput.disabled = Boolean(state.onboarding.finishing);
  }
  if (noInput instanceof HTMLInputElement) {
    noInput.checked = choice === "no";
    noInput.disabled = Boolean(state.onboarding.finishing);
  }
}

async function ensureOnboardingDefaultAccount() {
  const step = normalizeOnboardingStep(state.onboarding.step || "step1");
  if (step !== "step2" && step !== "step3") return;
  if (Array.isArray(state.accounts) && state.accounts.length > 0) return;
  try {
    await api("/api/v1/accounts", {
      method: "POST",
      body: JSON.stringify({
        name: t("onboardingDefaultAccountName"),
        type: "bank",
        currency: ensureUICurrency(state.onboarding.baseCurrency || state.settings?.base_currency || "USD"),
        balance: 0
      })
    });
    await loadAccounts();
  } catch (error) {
    showErrorToast(error);
  }
}

function isAutoDefaultOnboardingAccount(row) {
  if (!row) return false;
  const normalizedName = String(row.name || "").trim().toLowerCase();
  const expectedNames = new Set(
    [
      String(t("onboardingDefaultAccountName") || "").trim().toLowerCase(),
      "default",
      "默认账户"
    ].filter(Boolean)
  );
  const balance = Number(row.balance || 0);
  return expectedNames.has(normalizedName) && String(row.type || "") === "bank" && Math.abs(balance) < 0.000001;
}

async function cleanupRedundantOnboardingDefaultAccounts() {
  const accounts = Array.isArray(state.accounts) ? state.accounts : [];
  if (accounts.length <= 1) return false;
  const removable = accounts.filter((row) => isAutoDefaultOnboardingAccount(row));
  if (!removable.length) return false;
  const hasNonDefaultAccount = accounts.some((row) => !isAutoDefaultOnboardingAccount(row));
  if (!hasNonDefaultAccount) return false;
  for (const row of removable) {
    try {
      await api(`/api/v1/accounts/${row.id}?force=true`, { method: "DELETE" });
    } catch {
      // best effort cleanup only
    }
  }
  return true;
}

function renderOnboardingAccounts() {
  const target = $("#onboardingAccountList");
  if (!target) return;
  const rows = Array.isArray(state.accounts) ? state.accounts : [];
  if (!rows.length) {
    target.innerHTML = `<p class="muted">${escapeHtml(t("onboardingNoAccounts"))}</p>`;
    return;
  }
  target.innerHTML = rows
    .map(
      (row) => `
        <article class="list-row">
          <div>
            <strong>${escapeHtml(String(row.name || ""))}</strong>
            <p class="muted small">${escapeHtml(accountTypeLabel(row.type || ""))} · ${escapeHtml(String(row.currency || ""))}</p>
          </div>
          <div class="mono">${formatMoney(row.balance || 0)}</div>
        </article>
      `
    )
    .join("");
}

function getActiveOnboardingL1Categories() {
  return Object.entries(state.categories || {})
    .filter(([, cfg]) => Boolean(cfg?.active))
    .map(([name]) => String(name));
}

function renderOnboardingCategorySummary() {
  const target = $("#onboardingCategoryList");
  const parentSelect = $("#onboardingL2ParentSelect");
  if (parentSelect instanceof HTMLSelectElement) {
    parentSelect.innerHTML = "";
  }
  if (!target) return;
  const activeL1 = getActiveOnboardingL1Categories();
  if (!activeL1.length) {
    target.innerHTML = `<p class="muted">${escapeHtml(t("onboardingNoCategories"))}</p>`;
    return;
  }
  if (parentSelect instanceof HTMLSelectElement) {
    for (const l1 of activeL1) {
      parentSelect.appendChild(new Option(l1, l1));
    }
  }
  target.innerHTML = activeL1
    .map((l1) => {
      const l2Count = (state.categories?.[l1]?.l2 || []).filter((row) => row.active).length;
      return `
        <article class="list-row">
          <div>
            <strong>${escapeHtml(withL1Emoji(l1, { bilingualDefault: true, isDefault: Boolean(state.categories?.[l1]?.is_default) }))}</strong>
          </div>
          <div class="muted small">${l2Count} L2</div>
        </article>
      `;
    })
    .join("");
}

function renderOnboardingBudgetDraft() {
  const target = $("#onboardingBudgetList");
  if (!target) return;
  const activeL1 = getActiveOnboardingL1Categories();
  if (!activeL1.length) {
    target.innerHTML = "";
    return;
  }
  const rows = activeL1
    .map((l1) => ({
      l1,
      amount: Number(state.onboarding.budgetDraft?.[l1] || 0)
    }))
    .sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0));
  const budgetPool = Number(state.onboarding.budgetPool || 0);
  const currency = formatCurrencyUnit(state.onboarding.baseCurrency || state.settings?.base_currency || "USD");
  target.innerHTML = rows
    .map(
      ({ l1, amount }) => {
        const safeAmount = Number.isFinite(amount) ? Math.max(0, amount) : 0;
        const percent = budgetPool > 0 ? Math.round((safeAmount / budgetPool) * 100) : 0;
        return `
          <article class="onboarding-budget-row">
            <span class="onboarding-budget-name">${escapeHtml(withL1Emoji(l1, { localizeDefault: true, isDefault: Boolean(state.categories?.[l1]?.is_default) }))}</span>
            <span class="onboarding-budget-ratio">${escapeHtml(
              t("onboardingBudgetRatioText", {
                percent: String(percent),
                amount: formatMoney(safeAmount),
                currency
              })
            )}</span>
          </article>
        `;
      }
    )
    .join("");
  const hint = $("#onboardingBudgetHint");
  if (hint) {
    hint.textContent = t("onboardingBudgetHint");
  }
}

async function refreshOnboardingBudgetSuggestion(options = {}) {
  const preserveExisting = Boolean(options.preserveExisting);
  const activeL1 = getActiveOnboardingL1Categories();
  const suggestion = await api("/api/v1/onboarding/budget-suggestion", {
    method: "POST",
    body: JSON.stringify({
      income_band: ensureOnboardingIncomeBand(state.onboarding.incomeBand || "8000_20000"),
      base_currency: ensureUICurrency(state.onboarding.baseCurrency || "USD"),
      active_l1: activeL1
    })
  });
  state.onboarding.incomeEstimate = Number(suggestion?.estimated_monthly_income || 0);
  state.onboarding.budgetPool = Number(suggestion?.budget_pool || 0);
  state.onboarding.savingsBuffer = Number(suggestion?.savings_buffer || 0);
  const previous = preserveExisting && state.onboarding.budgetDraft ? { ...state.onboarding.budgetDraft } : {};
  const next = {};
  for (const row of suggestion?.allocations || []) {
    const key = String(row?.category_l1 || "");
    if (!key) continue;
    const fallback = Number(row?.recommended_amount || 0);
    const fromExisting = Number(previous[key]);
    next[key] = Number.isFinite(fromExisting) ? fromExisting : fallback;
  }
  for (const l1 of activeL1) {
    if (next[l1] === undefined) {
      const fromExisting = Number(previous[l1]);
      next[l1] = Number.isFinite(fromExisting) ? fromExisting : 0;
    }
  }
  state.onboarding.budgetDraft = next;
}

async function submitOnboardingStep1Form(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!(form instanceof HTMLFormElement)) return;
  const fd = new FormData(form);
  const livingCountryCode = ensureOnboardingCountryCode(fd.get("living_country_code"));
  const timezone = String(fd.get("timezone") || "").trim() || "UTC";
  const baseCurrency = ensureUICurrency(fd.get("base_currency") || "USD");
  const incomeBand = ensureOnboardingIncomeBand(fd.get("monthly_income_band") || "8000_20000");

  try {
    const updated = await api("/api/v1/settings", {
      method: "PUT",
      body: JSON.stringify({
        living_country_code: livingCountryCode,
        timezone,
        base_currency: baseCurrency,
        monthly_income_band: incomeBand
      })
    });
    state.settings = { ...(state.settings || {}), ...(updated || {}) };
    state.onboarding.countryCode = livingCountryCode;
    state.onboarding.timezone = timezone;
    state.onboarding.baseCurrency = baseCurrency;
    state.onboarding.incomeBand = incomeBand;
    await refreshOnboardingBudgetSuggestion({ preserveExisting: false });
    await api("/api/v1/onboarding/state", {
      method: "PUT",
      body: JSON.stringify({ current_step: "step2" })
    });
    state.onboarding.currentStep = "step2";
    state.onboarding.step = "step2";
    await ensureOnboardingDefaultAccount();
    renderOnboardingGate();
  } catch (error) {
    showErrorToast(error);
  }
}

async function submitOnboardingAccountForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!(form instanceof HTMLFormElement)) return;
  const fd = new FormData(form);
  const name = String(fd.get("name") || "").trim();
  if (!name) return;
  const payload = {
    name,
    type: String(fd.get("type") || "cash"),
    currency: ensureUICurrency(fd.get("currency") || state.onboarding.baseCurrency || "USD"),
    balance: Number(fd.get("balance") || 0)
  };
  if (!Number.isFinite(payload.balance)) payload.balance = 0;
  try {
    await api("/api/v1/accounts", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    form.reset();
    const currencyInput = $("#onboardingAccountCurrencyInput");
    if (currencyInput instanceof HTMLSelectElement) {
      currencyInput.value = ensureUICurrency(state.onboarding.baseCurrency || "USD");
    }
    await loadAccounts();
    const cleaned = await cleanupRedundantOnboardingDefaultAccounts();
    if (cleaned) await loadAccounts();
    renderOnboardingGate();
  } catch (error) {
    showErrorToast(error);
  }
}

async function addOnboardingL1Category() {
  const input = $("#onboardingNewL1Input");
  if (!(input instanceof HTMLInputElement)) return;
  const value = input.value.trim();
  if (!value) return;
  const ok = await createL1CategoryRecord(value);
  if (!ok) return;
  input.value = "";
  try {
    await refreshOnboardingBudgetSuggestion({ preserveExisting: true });
  } catch (error) {
    showErrorToast(error);
  }
  renderOnboardingGate();
}

async function addOnboardingL2Category() {
  const parentSelect = $("#onboardingL2ParentSelect");
  const input = $("#onboardingNewL2Input");
  if (!(parentSelect instanceof HTMLSelectElement) || !(input instanceof HTMLInputElement)) return;
  const l1Name = String(parentSelect.value || "").trim();
  const l2Name = input.value.trim();
  if (!l1Name || !l2Name) return;
  const ok = await createL2CategoryRecord(l1Name, l2Name);
  if (!ok) return;
  input.value = "";
  renderOnboardingGate();
}

async function submitOnboardingStep2() {
  if (!Array.isArray(state.accounts) || state.accounts.length < 1) {
    const message = t("onboardingNeedAccount");
    const node = $("#onboardingStep2Message");
    if (node) node.textContent = message;
    showToast(message, true);
    return;
  }
  const month = state.month || new Date().toISOString().slice(0, 7);
  const rows = Object.entries(state.onboarding.budgetDraft || {});
  try {
    for (const [categoryL1, rawAmount] of rows) {
      const amount = Number(rawAmount || 0);
      if (!Number.isFinite(amount) || amount <= 0) continue;
      await api("/api/v1/budgets", {
        method: "POST",
        body: JSON.stringify({
          month,
          category_l1: categoryL1,
          total_amount: Number(amount.toFixed(2))
        })
      });
    }
    await api("/api/v1/onboarding/state", {
      method: "PUT",
      body: JSON.stringify({ current_step: "step3" })
    });
    state.onboarding.currentStep = "step3";
    state.onboarding.step = "step3";
    const node = $("#onboardingStep2Message");
    if (node) node.textContent = t("onboardingSavedStep2");
    renderOnboardingGate();
  } catch (error) {
    showErrorToast(error);
  }
}

async function finishOnboarding(options = {}) {
  if (state.onboarding.finishing) return;
  const openAgentAccess = Boolean(options.openAgentAccess);
  state.onboarding.finishing = true;
  renderOnboardingGate();
  try {
    await api("/api/v1/onboarding/state", {
      method: "PUT",
      body: JSON.stringify({ completed: true, current_step: "completed" })
    });
    state.onboarding.completed = true;
    hideOnboardingGate({ keepState: true });
    await loadAll();
    if (openAgentAccess) {
      switchPanel("settingsPanel");
    }
  } catch (error) {
    showErrorToast(error);
  } finally {
    state.onboarding.finishing = false;
    if (!state.onboarding.completed) {
      renderOnboardingGate();
    }
  }
}

function setAuthMessage(message, options = {}) {
  const authMessage = $("#authMessage");
  if (!authMessage) return;
  authMessage.textContent = String(message || "");
  authMessage.classList.toggle("auth-message-error", Boolean(options.error && message));
}

function renderAuthGate() {
  const isCodeStep = state.auth.step === "code_step";
  const emailInput = $("#authEmailInput");
  const codeField = $("#authCodeField");
  const codeInput = $("#authCodeInput");
  const continueBtn = $("#authContinueBtn");
  const resendLine = $("#authResendLine");
  const resendText = $("#authResendText");
  const resendBtn = $("#authResendBtn");

  if (codeField) codeField.classList.toggle("hidden", !isCodeStep);

  if (emailInput instanceof HTMLInputElement) {
    if (isCodeStep && state.auth.pendingEmail) {
      emailInput.value = String(state.auth.pendingEmail);
    }
    emailInput.readOnly = isCodeStep;
  }

  if (codeInput instanceof HTMLInputElement) {
    codeInput.required = isCodeStep;
  }

  if (continueBtn instanceof HTMLButtonElement) {
    continueBtn.textContent = t("authContinueBtn");
    continueBtn.disabled = Boolean(state.auth.submitting);
  }

  if (resendLine) resendLine.classList.toggle("hidden", !isCodeStep);
  if (isCodeStep) {
    const cooldownSec = Math.max(0, Number(state.auth.resendCooldownSec || 0));
    if (cooldownSec > 0) {
      if (resendText) resendText.textContent = t("authResendIn", { seconds: String(cooldownSec) });
      if (resendBtn instanceof HTMLButtonElement) {
        resendBtn.classList.add("hidden");
        resendBtn.disabled = true;
      }
    } else {
      if (resendText) resendText.textContent = "";
      if (resendBtn instanceof HTMLButtonElement) {
        resendBtn.classList.remove("hidden");
        resendBtn.disabled = Boolean(state.auth.submitting);
      }
    }
  } else {
    if (resendText) resendText.textContent = "";
    if (resendBtn instanceof HTMLButtonElement) {
      resendBtn.classList.add("hidden");
      resendBtn.disabled = true;
    }
  }
}

function stopAuthResendCooldown(resetState = false) {
  if (authResendTimer) {
    clearInterval(authResendTimer);
    authResendTimer = null;
  }
  if (resetState) {
    state.auth.resendCooldownSec = 0;
  }
}

function startAuthResendCooldown(seconds = AUTH_RESEND_COOLDOWN_SECONDS) {
  stopAuthResendCooldown(false);
  state.auth.resendCooldownSec = Math.max(0, Math.floor(Number(seconds) || 0));
  renderAuthGate();
  if (state.auth.resendCooldownSec <= 0) return;
  authResendTimer = setInterval(() => {
    state.auth.resendCooldownSec = Math.max(0, Number(state.auth.resendCooldownSec || 0) - 1);
    if (state.auth.resendCooldownSec <= 0) {
      stopAuthResendCooldown(false);
    }
    renderAuthGate();
  }, 1000);
}

function resetAuthFormState() {
  stopAuthResendCooldown(true);
  state.auth.pendingEmail = "";
  state.auth.step = "email_step";
  state.auth.submitting = false;
  const emailInput = $("#authEmailInput");
  if (emailInput instanceof HTMLInputElement) {
    emailInput.value = "";
    emailInput.readOnly = false;
  }
  const codeInput = $("#authCodeInput");
  if (codeInput instanceof HTMLInputElement) {
    codeInput.value = "";
  }
  setAuthMessage("");
  renderAuthGate();
}

function syncDevBypassVisibility() {
  const showBypass = Boolean(state.auth.allowDevBypass && !state.auth.authenticated);
  const row = $("#quickSettingsUserRow");
  if (row) row.classList.toggle("hidden", !showBypass);
  const topUserInput = $("#userIdInput");
  if (topUserInput) {
    topUserInput.hidden = !showBypass;
    topUserInput.value = String(state.userId);
  }
}

function buildAuthRequestError(response, payload) {
  const detail =
    typeof payload?.error === "string"
      ? payload.error
      : payload?.error
        ? JSON.stringify(payload.error)
        : `${response.status} ${response.statusText}`;
  const error = new Error(detail);
  error.status = response.status;
  return error;
}

function resolveAuthErrorMessage(error, phase) {
  const status = Number(error?.status || 0);
  if (status === 429) return t("authTooMany");
  if (status === 502) return t("authEmailFailed");
  if (phase === "verify" && status === 400) return t("authCodeInvalid");
  if (phase === "request") return t("authRequestFailed");
  if (phase === "verify") return t("authVerifyFailed");
  return String(error?.message || t("authVerifyFailed"));
}

async function requestAuthCode(email, options = {}) {
  const asResend = Boolean(options.asResend);
  const response = await fetch("/api/v1/auth/code/request", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email })
  });
  const payload = await safeJson(response);
  if (!response.ok) {
    throw buildAuthRequestError(response, payload);
  }
  state.auth.pendingEmail = String(email || "").trim();
  state.auth.step = "code_step";
  startAuthResendCooldown();
  setAuthMessage(t("authCodeSentTo", { email: state.auth.pendingEmail }));
  renderAuthGate();
  const codeInput = $("#authCodeInput");
  if (codeInput instanceof HTMLInputElement) codeInput.focus();
  showToast(asResend ? t("authResendSent") : t("authSent"));
}

async function submitAuthGateForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!(form instanceof HTMLFormElement)) return;
  if (state.auth.submitting) return;
  const fd = new FormData(form);
  const email = String(fd.get("email") || "").trim();
  const isCodeStep = state.auth.step === "code_step";
  const code = String(fd.get("code") || "")
    .trim()
    .replace(/\s+/g, "");

  if (!email) return;
  if (isCodeStep && !code) return;

  state.auth.submitting = true;
  setAuthMessage("");
  renderAuthGate();
  try {
    if (!isCodeStep) {
      await requestAuthCode(email, { asResend: false });
      return;
    }

    const verifyRes = await fetch("/api/v1/auth/code/verify", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: state.auth.pendingEmail || email, code })
    });
    const verifyPayload = await safeJson(verifyRes);
    if (!verifyRes.ok) {
      throw buildAuthRequestError(verifyRes, verifyPayload);
    }
    setAuthMessage("");
    await loadAuthSession();
    if (!state.auth.authenticated) {
      throw new Error(t("authVerifyFailed"));
    }
    hideAuthGate();
    showToast(t("authSignedIn"));
    const onboardingActive = await maybeStartOnboardingFlow();
    if (!onboardingActive) {
      await loadAll();
    }
  } catch (error) {
    const message = resolveAuthErrorMessage(error, isCodeStep ? "verify" : "request");
    setAuthMessage(message, { error: true });
    showToast(message, true);
  } finally {
    state.auth.submitting = false;
    renderAuthGate();
  }
}

async function resendAuthCode() {
  if (state.auth.step !== "code_step") return;
  if (state.auth.submitting) return;
  if (Number(state.auth.resendCooldownSec || 0) > 0) return;
  const email = String(state.auth.pendingEmail || "").trim();
  if (!email) return;

  state.auth.submitting = true;
  setAuthMessage("");
  renderAuthGate();
  try {
    await requestAuthCode(email, { asResend: true });
  } catch (error) {
    const message = resolveAuthErrorMessage(error, "request");
    setAuthMessage(message, { error: true });
    showToast(message, true);
  } finally {
    state.auth.submitting = false;
    renderAuthGate();
  }
}

async function logoutCurrentSession() {
  try {
    await fetch("/api/v1/auth/logout", {
      method: "POST",
      credentials: "same-origin"
    });
  } catch {
    // ignore network errors and still clear client auth state
  }
  state.auth.authenticated = false;
  state.auth.user = null;
  state.auth.devBypass = false;
  state.auth.pendingEmail = "";
  state.auth.step = "email_step";
  state.auth.submitting = false;
  stopAuthResendCooldown(true);
  closeSheet("settingsSheet");
  closeAllSheets();
  closeUtilityPanel();
  hideOnboardingGate({ keepState: true });
  setAuthMessage("");
  showAuthGate();
}

async function loadAll() {
  if (!state.auth.authenticated) {
    return;
  }
  if (document.body.classList.contains("onboarding-required")) {
    return;
  }
  try {
    syncControlState();
    loadUiState();
    await Promise.all([loadSettings(), loadCategories(), loadAccounts(), loadAgentTokens()]);
    await Promise.all([
      loadDashboard(),
      loadTransactions(),
      loadRecentCompareData(),
      loadBudgets(),
      loadYearlyBudgets(),
      loadReview(),
      loadRisk()
    ]);
    await loadTrendData();
  } catch (error) {
    showErrorToast(error);
  }
}

async function loadSettings() {
  state.settings = (await api("/api/v1/settings")) || {
    base_currency: "USD",
    timezone: "UTC",
    ui_language: "en",
    theme: "system",
    currency_display_mode: "code",
    living_country_code: "",
    monthly_income_band: "8000_20000",
    onboarding_completed: false,
    onboarding_current_step: "step1"
  };

  // Auto-detect local timezone on first use (when server still has UTC default)
  if (!state.settings.timezone || state.settings.timezone === "UTC") {
    try {
      const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (localTz && localTz !== "UTC") {
        state.settings.timezone = localTz;
        // Persist silently so it sticks next load
        api("/api/v1/settings", {
          method: "PUT",
          body: JSON.stringify({
            base_currency: ensureUICurrency(state.settings.base_currency || "USD"),
            timezone: localTz,
            ui_language: ensureUILanguage(state.settings.ui_language || "en"),
            theme: ensureUITheme(state.settings.theme || "system"),
            currency_display_mode: ensureCurrencyDisplayMode(state.settings.currency_display_mode || "code"),
            living_country_code: String(state.settings.living_country_code || "").trim().toUpperCase(),
            monthly_income_band: ensureOnboardingIncomeBand(state.settings.monthly_income_band || "8000_20000")
          })
        }).catch(() => {});
      }
    } catch {
      // Intl not available — keep UTC
    }
  }

  const uiLanguage = ensureUILanguage(state.settings.ui_language || "en");
  state.settings.ui_language = uiLanguage;
  const uiBase = ensureUICurrency(state.settings.base_currency || "USD");
  const uiTheme = ensureUITheme(state.settings.theme || "system");
  state.settings.theme = uiTheme;
  const currencyDisplayMode = ensureCurrencyDisplayMode(state.settings.currency_display_mode || "code");
  state.settings.currency_display_mode = currencyDisplayMode;
  state.settings.living_country_code = String(state.settings.living_country_code || "").trim().toUpperCase();
  state.settings.monthly_income_band = ensureOnboardingIncomeBand(state.settings.monthly_income_band || "8000_20000");
  state.settings.onboarding_completed = Boolean(state.settings.onboarding_completed);
  state.settings.onboarding_current_step = normalizeOnboardingStep(state.settings.onboarding_current_step || "step1");
  state.onboarding.countryCode = state.settings.living_country_code || state.onboarding.countryCode;
  state.onboarding.timezone = state.settings.timezone || state.onboarding.timezone;
  state.onboarding.baseCurrency = uiBase;
  state.onboarding.incomeBand = ensureOnboardingIncomeBand(state.settings.monthly_income_band || state.onboarding.incomeBand);
  const settingsForm = $("#settingsForm");
  if (settingsForm instanceof HTMLFormElement) {
    const formLanguage = settingsForm.querySelector("[name=ui_language]");
    const formBase = settingsForm.querySelector("[name=base_currency]");
    const formTheme = settingsForm.querySelector("[name=theme]");
    const formCurrencyDisplay = settingsForm.querySelector("[name=currency_display_mode]");
    const formTimezone = settingsForm.querySelector("[name=timezone]");
    if (formLanguage) formLanguage.value = uiLanguage;
    if (formBase) formBase.value = uiBase;
    if (formTheme) formTheme.value = uiTheme;
    if (formCurrencyDisplay) formCurrencyDisplay.value = currencyDisplayMode;
    if (formTimezone) formTimezone.value = state.settings.timezone || "UTC";
  }
  $("#quickSettingsForm [name=ui_language]").value = uiLanguage;
  $("#quickSettingsForm [name=base_currency]").value = uiBase;
  $("#quickSettingsForm [name=theme]").value = uiTheme;
  $("#quickSettingsForm [name=currency_display_mode]").value = currencyDisplayMode;
  $("#quickSettingsForm [name=timezone]").value = state.settings.timezone || "UTC";
  const quickUserIdInput = $("#quickSettingsForm [name=user_id]");
  if (quickUserIdInput) quickUserIdInput.value = String(state.userId);
  const topBaseCurrencySelect = $("#topBaseCurrencySelect");
  if (topBaseCurrencySelect instanceof HTMLSelectElement) {
    topBaseCurrencySelect.value = uiBase;
  }
  syncTopCurrencyModeControl();
  const toggleCashFlow = $("#toggleCashFlow");
  const toggleRisk = $("#toggleRisk");
  const toggleTrend = $("#toggleTrend");
  const toggleDebug = $("#toggleDebug");
  const toggleRecentExpenses = $("#toggleRecentExpenses");
  const debugOnlyFailed = $("#debugOnlyFailed");
  const debugFilterInput = $("#debugFilterInput");
  if (toggleCashFlow) toggleCashFlow.checked = Boolean(state.ui.showCashFlow);
  if (toggleRisk) toggleRisk.checked = Boolean(state.ui.showRisk);
  if (toggleTrend) toggleTrend.checked = Boolean(state.ui.showTrend);
  if (toggleDebug) toggleDebug.checked = Boolean(state.ui.showDebug);
  if (toggleRecentExpenses) toggleRecentExpenses.checked = Boolean(state.ui.showRecentExpenses);
  const toggleTodayEl = $("#toggleToday");
  if (toggleTodayEl) toggleTodayEl.checked = Boolean(state.ui.showToday);
  const toggleRecentCompareEl = $("#toggleRecentCompare");
  if (toggleRecentCompareEl) toggleRecentCompareEl.checked = Boolean(state.ui.showRecentCompare);
  const toggleAccountsEl = $("#toggleAccounts");
  if (toggleAccountsEl) toggleAccountsEl.checked = Boolean(state.ui.showAccounts);
  if (debugOnlyFailed) debugOnlyFailed.checked = Boolean(state.debug.onlyFailed);
  if (debugFilterInput) debugFilterInput.value = state.debug.filter || "";
  applyTransactionFiltersToInputs();
  applyQuickEntryPreferencesForType(state.quickEntryType || "expense");
  syncDevBypassVisibility();
  applyAdvancedVisibility();
  renderDebugPanel();
  applyTheme(uiTheme);
  applyI18n();
}

async function switchTopBaseCurrency(nextBase) {
  const target = ensureUICurrency(nextBase || "USD");
  const current = ensureUICurrency(state.settings?.base_currency || "USD");
  if (target === current) return;
  try {
    await api("/api/v1/settings", {
      method: "PUT",
      body: JSON.stringify({
        base_currency: target,
        timezone: state.settings?.timezone || "UTC",
        ui_language: ensureUILanguage(state.settings?.ui_language || "en")
      })
    });
    showToast(t("settingsUpdated"));
    await loadAll();
  } catch (error) {
    const select = $("#topBaseCurrencySelect");
    if (select) select.value = current;
    showErrorToast(error);
  }
}

async function toggleTopCurrencyDisplayMode() {
  if (state.ui.currencyModeToggling) return;
  const currentMode = ensureCurrencyDisplayMode(state.settings?.currency_display_mode || "code");
  const nextMode = currentMode === "code" ? "symbol" : "code";
  state.ui.currencyModeToggling = true;
  try {
    await api("/api/v1/settings", {
      method: "PUT",
      body: JSON.stringify({
        base_currency: ensureUICurrency(state.settings?.base_currency || "USD"),
        timezone: state.settings?.timezone || "UTC",
        ui_language: ensureUILanguage(state.settings?.ui_language || "en"),
        theme: ensureUITheme(state.settings?.theme || "system"),
        currency_display_mode: nextMode,
        living_country_code: String(state.settings?.living_country_code || "").trim().toUpperCase(),
        monthly_income_band: ensureOnboardingIncomeBand(state.settings?.monthly_income_band || "8000_20000")
      })
    });
    await loadAll();
    showToast(t(nextMode === "symbol" ? "currencyDisplaySymbol" : "currencyDisplayCode"));
  } catch (error) {
    showErrorToast(error);
  } finally {
    state.ui.currencyModeToggling = false;
    syncTopCurrencyModeControl();
  }
}

async function loadCategories() {
  state.categories = (await api("/api/v1/categories")) || {};
  pruneCategoryEmojiMap();
  renderCategoryTree();
  populateL1Selects();
  populateTransactionEditL1Select();
  populateTransactionEditL2Select();
  populateQuickEntryL1();
  populateQuickBudgetL1();
  populateTransactionFilterCategorySelect();
  applyTransactionFiltersToInputs();
}

async function loadAccounts() {
  state.accounts = (await api("/api/v1/accounts")) || [];
  renderAccounts();
  await loadAccountPeriodTxs();
  populateAccountSelects();
  populateTransactionEditAccountSelects();
  populateQuickEntryAccounts();
}

function periodToDateRange(period) {
  const end = new Date();
  const start = new Date(end);
  if (period === "7d") start.setDate(start.getDate() - 6);
  else if (period === "1m") start.setMonth(start.getMonth() - 1);
  else if (period === "3m") start.setMonth(start.getMonth() - 3);
  const fmt = (d) => d.toISOString().slice(0, 10);
  return { start: fmt(start), end: fmt(end) };
}

async function loadAccountPeriodTxs(period) {
  if (!period) period = state.accountPeriod;
  else state.accountPeriod = period;
  const { start, end } = periodToDateRange(period);
  const rows = await api(`/api/v1/transactions?start=${start}&end=${end}`);
  state.accountPeriodTxs = Array.isArray(rows) ? rows : [];
  renderDashboardAccountsCard();
  // sync tab active state
  document.querySelectorAll(".acct-period-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.period === period);
  });
}

async function loadAgentTokens() {
  state.agentTokens = (await api("/api/v1/auth/agent-tokens")) || [];
  renderAgentTokens();
}

function populateL1Selects() {
  const activeL1 = Object.entries(state.categories || {}).filter(([, cfg]) => cfg.active);
  const selects = [
    $("#transactionForm [name=category_l1]"),
    $("#budgetForm [name=category_l1]"),
    $("#yearlyBudgetForm [name=category_l1]"),
    $("#budgetInlineForm [name=category_l1]"),
    $("#l2Form [name=l1_name]")
  ].filter(Boolean);
  for (const select of selects) {
    select.innerHTML = "";
    for (const [name, cfg] of activeL1) {
      select.appendChild(new Option(withL1Emoji(name, { bilingualDefault: true, isDefault: Boolean(cfg?.is_default) }), name));
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
    target.appendChild(
      new Option(
        withL2Emoji(row.name, l1, { bilingualDefault: true, isDefault: Boolean(row?.is_default) }),
        row.name
      )
    );
  }
}

function populateAccountSelects() {
  const from = $("#transactionForm [name=account_from_id]");
  const to = $("#transactionForm [name=account_to_id]");
  for (const select of [from, to]) {
    select.innerHTML = '<option value="">-- none --</option>';
    for (const account of state.accounts || []) {
      const label = `${account.name} · ${accountTypeLabel(account.type)} · ${formatMoney(account.balance)} ${formatCurrencyUnit(
        account.currency
      )}`;
      select.appendChild(new Option(label, String(account.id)));
    }
  }
}

function populateTransactionEditL1Select() {
  const select = $("#transactionEditForm [name=category_l1]");
  if (!select) return;
  const activeL1 = Object.entries(state.categories || {}).filter(([, cfg]) => cfg.active);
  select.innerHTML = '<option value="">-- none --</option>';
  for (const [name, cfg] of activeL1) {
    select.appendChild(new Option(withL1Emoji(name, { bilingualDefault: true, isDefault: Boolean(cfg?.is_default) }), name));
  }
}

function populateTransactionEditL2Select() {
  const l1Select = $("#transactionEditForm [name=category_l1]");
  const target = $("#transactionEditForm [name=category_l2]");
  if (!l1Select || !target) return;
  const l1 = l1Select.value;
  target.innerHTML = '<option value="">-- none --</option>';
  const rows = state.categories?.[l1]?.l2 || [];
  for (const row of rows) {
    if (!row.active) continue;
    target.appendChild(
      new Option(
        withL2Emoji(row.name, l1, { bilingualDefault: true, isDefault: Boolean(row?.is_default) }),
        row.name
      )
    );
  }
}

function populateTransactionEditAccountSelects() {
  const from = $("#transactionEditForm [name=account_from_id]");
  const to = $("#transactionEditForm [name=account_to_id]");
  for (const select of [from, to]) {
    if (!select) continue;
    select.innerHTML = '<option value="">-- none --</option>';
    for (const account of state.accounts || []) {
      const label = `${account.name} · ${accountTypeLabel(account.type)} · ${formatMoney(account.balance)} ${formatCurrencyUnit(
        account.currency
      )}`;
      select.appendChild(new Option(label, String(account.id)));
    }
  }
}

function populateQuickEntryL1() {
  const select = $("#quickEntryForm [name=category_l1]");
  if (!select) return;
  const activeL1 = Object.entries(state.categories || {}).filter(([, cfg]) => cfg.active);
  select.innerHTML = "";
  for (const [name, cfg] of activeL1) {
    select.appendChild(new Option(withL1Emoji(name, { bilingualDefault: true, isDefault: Boolean(cfg?.is_default) }), name));
  }
  if (activeL1.length && !select.value) {
    select.value = activeL1[0][0];
  }
  renderQuickL1Grid();
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
    l2Select.appendChild(
      new Option(
        withL2Emoji(row.name, l1, { bilingualDefault: true, isDefault: Boolean(row?.is_default) }),
        row.name
      )
    );
  }
  if (l2Select.options.length && !l2Select.value) {
    l2Select.value = l2Select.options[0].value;
  }
  renderQuickL1Grid();
  renderQuickL2Grid();
  void updateQuickEntryFlow();
}

function renderQuickL1Grid() {
  const grid = $("#quickL1Grid");
  const l1Select = $("#quickEntryForm [name=category_l1]");
  if (!grid || !l1Select) return;
  const activeL1 = Object.entries(state.categories || {}).filter(([, cfg]) => cfg.active);
  const selected = String(l1Select.value || "");
  grid.innerHTML = activeL1
    .map(([name, cfg]) => {
      const isActive = name === selected;
      return `
        <button class="quick-icon-btn ${isActive ? "active" : ""}" type="button" data-l1="${encodeURIComponent(name)}">
          <span class="icon">${escapeHtml(getL1EmojiSymbol(name))}</span>
          <span class="label">${escapeHtml(
            getL1DisplayName(name, { bilingualDefault: true, isDefault: Boolean(cfg?.is_default) })
          )}</span>
        </button>
      `;
    })
    .join("");
}

function renderQuickL2Grid() {
  const grid = $("#quickL2Grid");
  const l1Select = $("#quickEntryForm [name=category_l1]");
  const l2Select = $("#quickEntryForm [name=category_l2]");
  if (!grid || !l1Select || !l2Select) return;
  const l1 = String(l1Select.value || "");
  const rows = (state.categories?.[l1]?.l2 || []).filter((row) => row.active);
  const selected = String(l2Select.value || "");
  grid.innerHTML = rows
    .map((row) => {
      const label = String(row.name || "");
      const isActive = label === selected;
      return `
        <button class="quick-icon-btn ${isActive ? "active" : ""}" type="button" data-l2="${encodeURIComponent(label)}">
          <span class="icon">${escapeHtml(getL2EmojiSymbol(l1, label))}</span>
          <span class="label">${escapeHtml(
            getL2DisplayName(label, l1, { bilingualDefault: true, isDefault: Boolean(row?.is_default) })
          )}</span>
        </button>
      `;
    })
    .join("");
}

function renderQuickTransferReasonGrid() {
  const grid = $("#quickTransferReasonGrid");
  const select = $("#quickEntryForm [name=transfer_reason]");
  if (!grid || !(select instanceof HTMLSelectElement)) return;
  const selected = String(select.value || "normal");
  const reasons = ["normal", "loan", "borrow", "deposit_lock", "deposit_release"];
  grid.innerHTML = reasons
    .map((reason) => {
      const isActive = reason === selected;
      return `
        <button class="quick-icon-btn ${isActive ? "active" : ""}" type="button" data-transfer-reason="${escapeHtml(
          reason
        )}">
          <span class="icon">${escapeHtml(TRANSFER_REASON_EMOJI[reason] || "🔁")}</span>
          <span class="label">${escapeHtml(getTransferReasonLabel(reason))}</span>
        </button>
      `;
    })
    .join("");
}

function populateQuickEntryAccounts() {
  const select = $("#quickEntryForm [name=account_from_id]");
  const selectTo = $("#quickEntryForm [name=account_to_id]");
  if (!select) return;
  select.innerHTML = `<option value="">${escapeHtml(t("selectAccount"))}</option>`;
  for (const account of state.accounts || []) {
    const label = `${account.name}`;
    select.appendChild(new Option(label, String(account.id)));
  }
  if (selectTo) {
    selectTo.innerHTML = `<option value="">${escapeHtml(t("selectAccount"))}</option>`;
    for (const account of state.accounts || []) {
      const label = `${account.name}`;
      selectTo.appendChild(new Option(label, String(account.id)));
    }
  }
  applyQuickEntryPreferencesForType(state.quickEntryType || "expense");
  void updateQuickEntryFlow();
}

function populateQuickBudgetL1() {
  const select = $("#quickBudgetForm [name=category_l1]");
  if (!select) return;
  const activeL1 = Object.entries(state.categories || {}).filter(([, cfg]) => cfg.active);
  select.innerHTML = "";
  for (const [name, cfg] of activeL1) {
    select.appendChild(new Option(withL1Emoji(name, { bilingualDefault: true, isDefault: Boolean(cfg?.is_default) }), name));
  }
}

function setupQuickAmountWheel() {
  const keypad = $("#quickKeypad");
  const amountInput = $("#quickEntryForm [name=amount_original]");
  if (!amountInput) return;
  const isCoarsePointer =
    typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
  if (isCoarsePointer) {
    amountInput.readOnly = true;
    amountInput.setAttribute("inputmode", "none");
  }
  let lastHapticAt = 0;
  let lastPointerHandledAt = 0;
  let scheduledSyncRaf = 0;
  let pendingSyncValue = amountInput.value || 0;

  const scheduleAmountUiSync = (value) => {
    pendingSyncValue = value;
    if (scheduledSyncRaf) return;
    scheduledSyncRaf = window.requestAnimationFrame(() => {
      syncQuickAmountDisplay(pendingSyncValue);
      validateQuickEntryAmount();
      scheduledSyncRaf = 0;
    });
  };

  const setQuickAmountValue = (rawText) => {
    let nextText = sanitizeQuickAmountText(rawText);
    let numeric = clampQuickAmount(nextText);
    const max = Number(state.quickEntryMax || 0);
    if (numeric > max && max > 0) {
      numeric = max;
      nextText = sanitizeQuickAmountText(String(max));
    }
    amountInput.value = nextText || "";
    scheduleAmountUiSync(nextText || numeric || 0);
  };

  const applyKeypadInput = (key) => {
    const currentText = sanitizeQuickAmountText(amountInput.value);
    let nextText = currentText;
    if (key === "back") {
      nextText = currentText.slice(0, -1);
    } else if (key === "clear") {
      nextText = "";
    } else if (key === ".") {
      if (!currentText.includes(".")) nextText = currentText ? `${currentText}.` : "0.";
    } else if (/^\d+$/.test(key)) {
      nextText = `${currentText}${key}`;
    }
    setQuickAmountValue(nextText);
    if (navigator.vibrate && key !== "back" && key !== "clear") {
      const now = Date.now();
      if (now - lastHapticAt > 120) {
        navigator.vibrate(4);
        lastHapticAt = now;
      }
    }
  };

  const getKeyFromEvent = (event) => {
    if (!(event.target instanceof Element)) return "";
    const keyBtn = event.target.closest("button[data-keypad]");
    if (!keyBtn) return "";
    return String(keyBtn.getAttribute("data-keypad") || "");
  };

  amountInput.addEventListener("focus", () => {
    if (isCoarsePointer) amountInput.blur();
  });

  amountInput.addEventListener("input", () => {
    setQuickAmountValue(amountInput.value);
  });

  if (keypad) {
    keypad.addEventListener("pointerdown", (event) => {
      const key = getKeyFromEvent(event);
      if (!key) return;
      event.preventDefault();
      lastPointerHandledAt = Date.now();
      applyKeypadInput(key);
    });
    keypad.addEventListener("click", (event) => {
      if (Date.now() - lastPointerHandledAt < 320) return;
      const key = getKeyFromEvent(event);
      if (!key) return;
      applyKeypadInput(key);
    });
  }
  scheduleAmountUiSync(amountInput.value || 0);
}

async function updateQuickEntryFlow() {
  const l1 = $("#quickEntryForm [name=category_l1]")?.value || "";
  const l2 = $("#quickEntryForm [name=category_l2]")?.value || "";
  const accountId = parseOptionalInt($("#quickEntryForm [name=account_from_id]")?.value);
  const accountToId = parseOptionalInt($("#quickEntryForm [name=account_to_id]")?.value);
  const transferReason = getQuickTransferReason();
  const transferConfig = getTransferReasonConfig(transferReason);
  const currency = ensureUICurrency($("#quickEntryForm [name=currency_original]")?.value || "USD");

  syncQuickEntryAccountVisibility();

  const isExpense = state.quickEntryType === "expense";
  const isIncome = state.quickEntryType === "income";
  const isTransfer = state.quickEntryType === "transfer";
  toggleQuickStep("quickStepL1", isExpense);
  toggleQuickStep("quickStepL2", isExpense && Boolean(l1));
  toggleQuickStep("quickStepTransferReason", isTransfer);
  toggleQuickStep("quickStepSpend", false);

  const spendReady = isExpense
    ? Boolean(currency)
    : isIncome
      ? Boolean(currency)
      : Boolean(
          (!transferConfig.needsFrom || accountId) && (!transferConfig.needsTo || accountToId) && currency
        );
  const amountStepVisible = isExpense ? Boolean(l1 && l2 && spendReady) : spendReady;
  toggleQuickStep("quickStepAmount", amountStepVisible);
  syncQuickComposerVisibility();

  if (!amountStepVisible) {
    applyQuickEntryMax(0, currency);
    validateQuickEntryAmount();
    return;
  }

  const unassignedHint = t("quickUnassignedHint");
  if (isExpense && !accountId) {
    applyQuickEntryMax(99999999, currency, { customHint: unassignedHint });
    return;
  }
  if (isIncome && !accountToId) {
    applyQuickEntryMax(99999999, currency, { customHint: unassignedHint });
    return;
  }
  if (isExpense || (isTransfer && transferConfig.needsFrom)) {
    await refreshQuickEntryAmountLimit(accountId, currency);
  } else {
    applyQuickEntryMax(99999999, currency);
  }
}

function toggleQuickStep(id, visible) {
  const node = document.getElementById(id);
  if (!node) return;
  node.classList.toggle("hidden", !visible);
}

function syncQuickComposerVisibility() {
  const composer = $("#quickComposerCard");
  const amount = $("#quickStepAmount");
  if (!composer || !amount) return;
  const show = !amount.classList.contains("hidden");
  composer.classList.toggle("hidden", !show);
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

  const l1Select = $("#quickEntryForm [name=category_l1]");
  const l2Select = $("#quickEntryForm [name=category_l2]");
  if (l1Select) l1Select.toggleAttribute("required", next === "expense");
  if (l2Select) l2Select.toggleAttribute("required", next === "expense");

  applyQuickEntryPreferencesForType(next);
  syncQuickEntryAccountVisibility();
  applyI18n();
  renderQuickL1Grid();
  renderQuickL2Grid();
  renderQuickTransferReasonGrid();
  void updateQuickEntryFlow();
}

function applyQuickEntryPreferencesForType(type) {
  const mode = type === "income" || type === "transfer" ? type : "expense";
  const prefs = state.quickPreferences?.[mode] || {};
  const baseCurrency = ensureUICurrency(state.settings?.base_currency || "USD");
  const currencySelect = $("#quickEntryForm [name=currency_original]");
  if (currencySelect) {
    const preferredCurrency = ensureUICurrency(prefs.currency_original || baseCurrency);
    setSelectValueIfExists(currencySelect, preferredCurrency);
  }
  if (mode === "expense") {
    const from = $("#quickEntryForm [name=account_from_id]");
    if (from) setSelectValueIfExists(from, prefs.account_from_id || "");
  } else if (mode === "income") {
    const to = $("#quickEntryForm [name=account_to_id]");
    if (to) setSelectValueIfExists(to, prefs.account_to_id || "");
  } else {
    const from = $("#quickEntryForm [name=account_from_id]");
    const to = $("#quickEntryForm [name=account_to_id]");
    const reason = $("#quickEntryForm [name=transfer_reason]");
    if (from) setSelectValueIfExists(from, prefs.account_from_id || "");
    if (to) setSelectValueIfExists(to, prefs.account_to_id || "");
    if (reason) setSelectValueIfExists(reason, prefs.transfer_reason || "normal");
  }
}

function rememberQuickEntryPreferences() {
  const mode = state.quickEntryType === "income" || state.quickEntryType === "transfer" ? state.quickEntryType : "expense";
  const currency = ensureUICurrency($("#quickEntryForm [name=currency_original]")?.value || "USD");
  const fromValue = String($("#quickEntryForm [name=account_from_id]")?.value || "");
  const toValue = String($("#quickEntryForm [name=account_to_id]")?.value || "");
  if (mode === "expense") {
    state.quickPreferences.expense = {
      ...state.quickPreferences.expense,
      account_from_id: fromValue,
      currency_original: currency
    };
  } else if (mode === "income") {
    state.quickPreferences.income = {
      ...state.quickPreferences.income,
      account_to_id: toValue,
      currency_original: currency
    };
  } else {
    state.quickPreferences.transfer = {
      ...state.quickPreferences.transfer,
      account_from_id: fromValue,
      account_to_id: toValue,
      currency_original: currency,
      transfer_reason: getQuickTransferReason()
    };
  }
  persistQuickEntryPreferences();
}

function setSelectValueIfExists(selectEl, value) {
  if (!(selectEl instanceof HTMLSelectElement)) return;
  const text = String(value || "");
  if (!text) return;
  const hasOption = Array.from(selectEl.options).some((opt) => String(opt.value) === text);
  if (hasOption) selectEl.value = text;
}

function loadQuickEntryPreferences() {
  try {
    const raw = localStorage.getItem("nfos_quick_entry_preferences");
    if (!raw) return;
    const parsed = JSON.parse(raw);
    const next = {
      expense: {
        account_from_id: String(parsed?.expense?.account_from_id || ""),
        currency_original: ensureUICurrency(parsed?.expense?.currency_original || "USD")
      },
      income: {
        account_to_id: String(parsed?.income?.account_to_id || ""),
        currency_original: ensureUICurrency(parsed?.income?.currency_original || "USD")
      },
      transfer: {
        account_from_id: String(parsed?.transfer?.account_from_id || ""),
        account_to_id: String(parsed?.transfer?.account_to_id || ""),
        currency_original: ensureUICurrency(parsed?.transfer?.currency_original || "USD"),
        transfer_reason: String(parsed?.transfer?.transfer_reason || "normal")
      }
    };
    state.quickPreferences = next;
  } catch {
    // ignore localStorage errors
  }
}

function persistQuickEntryPreferences() {
  try {
    localStorage.setItem("nfos_quick_entry_preferences", JSON.stringify(state.quickPreferences));
  } catch {
    // ignore localStorage errors
  }
}

function updateQuickDateDisplay() {
  const textEl = $("#quickDateToggleText");
  if (!textEl) return;
  const dateInput = $("#quickEntryForm [name=date]");
  const selected = parseDateOnlyLocal(dateInput?.value);
  if (!selected) {
    textEl.textContent = t("relativeToday");
    return;
  }
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.floor((today.getTime() - selected.getTime()) / 86400000);
  if (diffDays === 0) {
    textEl.textContent = t("relativeToday");
    return;
  }
  if (diffDays === 1) {
    textEl.textContent = t("quickDateYesterday");
    return;
  }
  if (diffDays === 2) {
    textEl.textContent = t("quickDateDayBefore");
    return;
  }
  const lang = ensureUILanguage(state.settings?.ui_language || "en");
  if (lang === "zh") {
    textEl.textContent = `${selected.getMonth() + 1}月${selected.getDate()}日`;
    return;
  }
  const monthFmt = new Intl.DateTimeFormat("en-US", { month: "short" });
  textEl.textContent = `${monthFmt.format(selected)} ${selected.getDate()}`;
}

function getTransferReasonConfig(reason) {
  const value = String(reason || "normal");
  if (value === "loan") {
    return { needsFrom: true, needsTo: false };
  }
  if (value === "borrow") {
    return { needsFrom: false, needsTo: true };
  }
  return { needsFrom: true, needsTo: true };
}

function getQuickTransferReason() {
  return String($("#quickEntryForm [name=transfer_reason]")?.value || "normal");
}

function getTransferReasonLabel(reason) {
  const keyMap = {
    normal: "transferReasonNormal",
    loan: "transferReasonLoan",
    borrow: "transferReasonBorrow",
    deposit_lock: "transferReasonDepositLock",
    deposit_release: "transferReasonDepositRelease"
  };
  return t(keyMap[String(reason || "normal")] || "transferReasonNormal");
}

function applyTransferReasonOptionLabels(select) {
  if (!(select instanceof HTMLSelectElement)) return;
  for (const option of Array.from(select.options)) {
    option.textContent = getTransferReasonLabel(option.value);
  }
}

function syncQuickEntryAccountVisibility() {
  const next = state.quickEntryType === "income" || state.quickEntryType === "transfer" ? state.quickEntryType : "expense";
  const accountFrom = $("#quickEntryForm [name=account_from_id]");
  const accountFromWrap = $("#quickEntryAccountFromWrap");
  const accountTo = $("#quickEntryForm [name=account_to_id]");
  const accountToWrap = $("#quickEntryAccountToWrap");
  const transferReasonWrap = $("#quickEntryTransferReasonWrap");
  const transferReasonSelect = $("#quickEntryForm [name=transfer_reason]");
  const transferConfig = getTransferReasonConfig(getQuickTransferReason());

  if (accountFrom) {
    const requiresFrom = next === "transfer" && transferConfig.needsFrom;
    accountFrom.toggleAttribute("required", requiresFrom);
  }
  if (accountFromWrap) {
    accountFromWrap.classList.toggle(
      "hidden",
      next === "income" || (next === "transfer" && !transferConfig.needsFrom)
    );
  }
  if (accountTo) {
    const requiresTo = next === "transfer" && transferConfig.needsTo;
    accountTo.toggleAttribute("required", requiresTo);
  }
  if (accountToWrap) {
    accountToWrap.classList.toggle(
      "hidden",
      next === "expense" || (next === "transfer" && !transferConfig.needsTo)
    );
  }
  if (transferReasonWrap) transferReasonWrap.classList.toggle("hidden", next !== "transfer");
  if (transferReasonSelect && next !== "transfer") {
    transferReasonSelect.value = "normal";
  }
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

function applyQuickEntryMax(maxAmount, currency, options = {}) {
  const amountInput = $("#quickEntryForm [name=amount_original]");
  const hint = $("#quickAmountHint");
  if (!amountInput || !hint) return;

  state.quickEntryMax = Number.isFinite(Number(maxAmount)) ? Math.max(0, Number(maxAmount)) : 0;
  amountInput.max = String(state.quickEntryMax);

  const current = clampQuickAmount(amountInput.value);
  amountInput.value = String(current);
  syncQuickAmountDisplay(current);
  const customHint = String(options.customHint || "");
  if (customHint) {
    hint.textContent = customHint;
    return;
  }
  hint.textContent = t("maxSpendHint", {
    amount: formatMoney(state.quickEntryMax),
    currency: formatCurrencyUnit(currency || "USD")
  });
}

function clampQuickAmount(value) {
  const raw = Number(value || 0);
  const max = Math.max(0, Number(state.quickEntryMax || 0));
  if (!Number.isFinite(raw)) return 0;
  return Number(Math.min(Math.max(0, raw), max).toFixed(2));
}

function sanitizeQuickAmountText(value) {
  const text = String(value || "");
  const filtered = text.replace(/[^\d.]/g, "");
  if (!filtered) return "";
  const [head, ...tail] = filtered.split(".");
  const intPart = head.replace(/^0+(?=\d)/, "") || (head.startsWith("0") ? "0" : head);
  const trailingDot = filtered.endsWith(".") && tail.length <= 1;
  const decimals = tail.join("").slice(0, 2);
  if (trailingDot && !decimals.length) return `${intPart}.`;
  return decimals.length ? `${intPart}.${decimals}` : intPart;
}

function syncQuickAmountDisplay(value) {
  const amountDisplay = $("#quickAmountDisplay");
  const amountInput = $("#quickAmountInput");
  if (amountInput) {
    const normalized = sanitizeQuickAmountText(String(value || "0"));
    if (normalized !== amountInput.value && normalized !== "") {
      amountInput.value = normalized;
    }
  }
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
  const transferReason = String($("#transactionForm [name=transfer_reason]")?.value || "normal");
  const transferConfig = getTransferReasonConfig(transferReason);
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
    fromLabel.classList.toggle("hidden", !transferConfig.needsFrom);
    toLabel.classList.toggle("hidden", !transferConfig.needsTo);
  }
}

function handleTransactionEditTypeChange() {
  const form = $("#transactionEditForm");
  if (!(form instanceof HTMLFormElement)) return;
  const type = String(form.elements.type?.value || "expense");
  const transferReason = String(form.elements.transfer_reason?.value || "normal");
  const transferConfig = getTransferReasonConfig(transferReason);
  const categoryL1 = form.elements.category_l1?.closest("label");
  const categoryL2 = form.elements.category_l2?.closest("label");
  const fromLabel = form.elements.account_from_id?.closest("label");
  const toLabel = form.elements.account_to_id?.closest("label");
  const reasonLabel = form.elements.transfer_reason?.closest("label");

  if (categoryL1) categoryL1.classList.toggle("hidden", type !== "expense");
  if (categoryL2) categoryL2.classList.toggle("hidden", type !== "expense");
  if (reasonLabel) reasonLabel.classList.toggle("hidden", type !== "transfer");

  if (type === "income") {
    fromLabel?.classList.add("hidden");
    toLabel?.classList.remove("hidden");
  } else if (type === "expense") {
    fromLabel?.classList.remove("hidden");
    toLabel?.classList.add("hidden");
  } else {
    fromLabel?.classList.toggle("hidden", !transferConfig.needsFrom);
    toLabel?.classList.toggle("hidden", !transferConfig.needsTo);
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
    showToast(t("accountCreated"));
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
  const payload = buildTransactionPayloadFromForm(fd);

  try {
    await api("/api/v1/transactions", { method: "POST", body: JSON.stringify(payload) });
    showToast(t("transactionCreated"));
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
  const requestedAmount = Number(sanitizeQuickAmountText(String(fd.get("amount_original") || "")));
  const currencyCode = ensureUICurrency(String(fd.get("currency_original") || "USD").toUpperCase());
  const transferReason = String(fd.get("transfer_reason") || "normal");
  const transferConfig = getTransferReasonConfig(transferReason);
  if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
    showToast(t("invalidAmount"), true);
    return;
  }
  if (
    (state.quickEntryType === "expense" || (state.quickEntryType === "transfer" && transferConfig.needsFrom)) &&
    requestedAmount > Number(state.quickEntryMax || 0)
  ) {
    showToast(
      t("amountExceeded", {
        amount: formatMoney(state.quickEntryMax),
        currency: formatCurrencyUnit(currencyCode)
      }),
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
      state.quickEntryType === "expense"
        ? parseOptionalInt(fd.get("account_from_id"))
        : state.quickEntryType === "transfer" && transferConfig.needsFrom
          ? parseOptionalInt(fd.get("account_from_id"))
          : undefined,
    account_to_id:
      state.quickEntryType === "income"
        ? parseOptionalInt(fd.get("account_to_id"))
        : state.quickEntryType === "transfer" && transferConfig.needsTo
          ? parseOptionalInt(fd.get("account_to_id"))
          : undefined,
    transfer_reason: state.quickEntryType === "transfer" ? transferReason : undefined,
    note: fd.get("note") || "",
    tags: []
  };
  rememberQuickEntryPreferences();
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
      syncQuickAmountDisplay(0);
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
    showToast(t("monthlyBudgetSaved"));
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
    showToast(t("yearlyBudgetSaved"));
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
  await createL1CategoryRecord(String(fd.get("name") || ""), form);
}

async function submitL2Form(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!(form instanceof HTMLFormElement)) return;
  const fd = new FormData(form);
  await createL2CategoryRecord(String(fd.get("l1_name") || ""), String(fd.get("name") || ""), form);
}

async function createL1CategoryInline() {
  openCategoryPrompt("l1");
}

async function createL2CategoryInline(l1Name) {
  openCategoryPrompt("l2", l1Name);
}

function openCategoryPrompt(mode, l1Name = "") {
  const form = $("#categoryPromptForm");
  if (!(form instanceof HTMLFormElement)) return;
  const safeMode = mode === "l2" || mode === "edit_l1" ? mode : "l1";
  form.reset();
  form.elements.mode.value = safeMode;
  form.elements.l1_name.value = String(l1Name || "").trim();
  form.elements.old_name.value = safeMode === "edit_l1" ? String(l1Name || "").trim() : "";
  form.elements.emoji.value =
    safeMode === "edit_l1" ? getL1EmojiSymbol(String(l1Name || "").trim()) : "";
  form.elements.name.value = safeMode === "edit_l1" ? String(l1Name || "").trim() : "";
  updateCategoryPromptView();
  openSheet("categoryPromptSheet", { preserveUtility: true });
  const nameInput = $("#categoryPromptNameInput");
  if (nameInput) {
    window.requestAnimationFrame(() => {
      nameInput.focus();
    });
  }
}

function updateCategoryPromptView() {
  const form = $("#categoryPromptForm");
  if (!(form instanceof HTMLFormElement)) return;
  const mode = String(form.elements.mode.value || "l1");
  const l1Name = String(form.elements.l1_name.value || "").trim();
  const l1Cfg = state.categories?.[l1Name];
  const l1Display = getL1DisplayName(l1Name, {
    bilingualDefault: true,
    isDefault: Boolean(l1Cfg?.is_default)
  });
  const isL2 = mode === "l2";
  const isEditL1 = mode === "edit_l1";
  const titleKey = isL2
    ? "categoryPromptTitleL2"
    : isEditL1
      ? "categoryPromptTitleEditL1"
      : "categoryPromptTitleL1";
  const nameLabelKey = isL2 ? "categoryPromptNameLabelL2" : "categoryPromptNameLabelL1";
  const saveKey = isL2
    ? "categoryPromptSaveL2"
    : isEditL1
      ? "categoryPromptSaveEditL1"
      : "categoryPromptSaveL1";
  setText("categoryPromptTitle", t(titleKey, { l1: l1Display || l1Name }));
  setText("categoryPromptEmojiLabel", t("categoryPromptEmojiLabel"));
  setText("categoryPromptNameLabel", t(nameLabelKey));
  setText("categoryPromptSaveBtn", t(saveKey));
  setText("categoryPromptParentLabel", t("categoryPromptParentLabel"));
  const parentInput = $("#categoryPromptParentInput");
  if (parentInput) {
    parentInput.value = isL2 ? withL1Emoji(l1Name, { bilingualDefault: true, isDefault: Boolean(l1Cfg?.is_default) }) : "";
  }
  const parentLabel = $("#categoryPromptParentLabel")?.closest("label");
  if (parentLabel) parentLabel.classList.toggle("hidden", !isL2);
  const emojiInput = $("#categoryPromptEmojiInput");
  if (emojiInput) emojiInput.placeholder = t("categoryPromptEmojiPlaceholder");
  const nameInput = $("#categoryPromptNameInput");
  if (nameInput) {
    nameInput.placeholder =
      isL2 ? t("categoryPromptNamePlaceholderL2") : t("categoryPromptNamePlaceholderL1");
  }
}

async function submitCategoryPromptForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!(form instanceof HTMLFormElement)) return;
  const mode = String(form.elements.mode.value || "l1");
  const oldName = String(form.elements.old_name.value || "").trim();
  const l1Name = String(form.elements.l1_name.value || "").trim();
  const name = String(form.elements.name.value || "").trim();
  const emoji = String(form.elements.emoji.value || "").trim();
  if (!name) return;
  if (mode === "l2") {
    const ok = await createL2CategoryRecord(l1Name, name, null, { emoji });
    if (!ok) return;
  } else if (mode === "edit_l1") {
    const ok = await updateL1CategoryRecord(oldName, name, { emoji });
    if (!ok) return;
  } else {
    const ok = await createL1CategoryRecord(name, null, { emoji });
    if (!ok) return;
  }
  closeSheet("categoryPromptSheet");
}

async function deleteL2CategoryInline(l1Name, l2Name) {
  const l1Cfg = state.categories?.[String(l1Name || "").trim()];
  const l2Row = (l1Cfg?.l2 || []).find((row) => String(row?.name || "").trim() === String(l2Name || "").trim());
  const l1Display = getL1DisplayName(l1Name, { bilingualDefault: true, isDefault: Boolean(l1Cfg?.is_default) });
  const l2Display = getL2DisplayName(l2Name, l1Name, {
    bilingualDefault: true,
    isDefault: Boolean(l2Row?.is_default)
  });
  const confirmText = t("confirmDeleteL2", { l1: l1Display || l1Name, l2: l2Display || l2Name });
  const ok = window.confirm(confirmText);
  if (!ok) return;
  try {
    await api("/api/v1/categories/l2", {
      method: "DELETE",
      body: JSON.stringify({
        l1_name: l1Name,
        name: l2Name
      })
    });
    delete state.categoryEmoji.l2[buildL2EmojiKey(l1Name, l2Name)];
    persistUiState();
    showToast(t("categoryL2Deleted"));
    try {
      await loadCategories();
    } catch (error) {
      showRefreshFailureToast(error);
    }
  } catch (error) {
    showErrorToast(error);
  }
}

async function createL1CategoryRecord(name, formToReset = null, options = {}) {
  const safeName = String(name || "").trim();
  if (!safeName) return false;
  try {
    await api("/api/v1/categories/l1", {
      method: "POST",
      body: JSON.stringify({ name: safeName })
    });
    const emoji = normalizeEmojiInput(options.emoji);
    if (emoji) {
      state.categoryEmoji.l1[safeName] = emoji;
      persistUiState();
    }
    showToast(t("categoryL1Updated"));
    try {
      await loadCategories();
      if (formToReset instanceof HTMLFormElement) formToReset.reset();
      return true;
    } catch (error) {
      showRefreshFailureToast(error);
      return false;
    }
  } catch (error) {
    showErrorToast(error);
    return false;
  }
}

async function updateL1CategoryRecord(oldName, newName, options = {}) {
  const safeOldName = String(oldName || "").trim();
  const safeNewName = String(newName || "").trim();
  if (!safeOldName || !safeNewName) return false;
  try {
    await api("/api/v1/categories/l1/rename", {
      method: "PUT",
      body: JSON.stringify({
        old_name: safeOldName,
        new_name: safeNewName
      })
    });
    const nextL1Emoji = {};
    for (const [name, emoji] of Object.entries(state.categoryEmoji?.l1 || {})) {
      if (name === safeOldName) continue;
      if (emoji) nextL1Emoji[name] = emoji;
    }
    const nextL2Emoji = {};
    for (const [key, emoji] of Object.entries(state.categoryEmoji?.l2 || {})) {
      const [l1, l2] = String(key || "").split("|||");
      if (!emoji || !l2) continue;
      const targetL1 = l1 === safeOldName ? safeNewName : l1;
      nextL2Emoji[buildL2EmojiKey(targetL1, l2)] = emoji;
    }
    const emoji = normalizeEmojiInput(options.emoji);
    if (emoji) {
      nextL1Emoji[safeNewName] = emoji;
    } else if (state.categoryEmoji?.l1?.[safeOldName]) {
      nextL1Emoji[safeNewName] = state.categoryEmoji.l1[safeOldName];
    }
    state.categoryEmoji = { l1: nextL1Emoji, l2: nextL2Emoji };
    persistUiState();
    showToast(t("categoryL1Created"));
    try {
      await loadCategories();
      return true;
    } catch (error) {
      showRefreshFailureToast(error);
      return false;
    }
  } catch (error) {
    showErrorToast(error);
    return false;
  }
}

async function createL2CategoryRecord(l1Name, l2Name, formToReset = null, options = {}) {
  const safeL1Name = String(l1Name || "").trim();
  const safeL2Name = String(l2Name || "").trim();
  if (!safeL1Name || !safeL2Name) return false;
  try {
    await api("/api/v1/categories/l2", {
      method: "POST",
      body: JSON.stringify({
        l1_name: safeL1Name,
        name: safeL2Name
      })
    });
    const emoji = normalizeEmojiInput(options.emoji);
    if (emoji) {
      state.categoryEmoji.l2[buildL2EmojiKey(safeL1Name, safeL2Name)] = emoji;
      persistUiState();
    }
    showToast(t("categoryL2Created"));
    try {
      await loadCategories();
      if (formToReset instanceof HTMLFormElement) formToReset.reset();
      return true;
    } catch (error) {
      showRefreshFailureToast(error);
      return false;
    }
  } catch (error) {
    showErrorToast(error);
    return false;
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
        ui_language: ensureUILanguage(fd.get("ui_language")),
        theme: ensureUITheme(fd.get("theme")),
        currency_display_mode: ensureCurrencyDisplayMode(fd.get("currency_display_mode"))
      })
    });
    showToast(t("settingsUpdated"));
    try {
      await loadSettings();
      await Promise.all([loadDashboard(), loadBudgets(), loadYearlyBudgets(), loadRecentCompareData()]);
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
  if (state.auth.allowDevBypass && !state.auth.authenticated) {
    const nextUserId = Math.max(1, Number(fd.get("user_id") || 1));
    $("#userIdInput").value = String(nextUserId);
    state.userId = nextUserId;
    state.auth.devBypass = true;
  }
  try {
    await api("/api/v1/settings", {
      method: "PUT",
      body: JSON.stringify({
        base_currency: String(fd.get("base_currency") || "USD").toUpperCase(),
        timezone: fd.get("timezone") || "UTC",
        ui_language: ensureUILanguage(fd.get("ui_language")),
        theme: ensureUITheme(fd.get("theme")),
        currency_display_mode: ensureCurrencyDisplayMode(fd.get("currency_display_mode"))
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

async function submitAgentTokenForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!(form instanceof HTMLFormElement)) return;
  const fd = new FormData(form);
  const name = String(fd.get("name") || "").trim();
  if (!name) return;
  try {
    const created = await api("/api/v1/auth/agent-tokens", {
      method: "POST",
      body: JSON.stringify({ name })
    });
    state.latestAgentTokenPlaintext = String(created?.token || "");
    closeSheet("agentTokenCreateSheet");
    showAgentTokenReveal(state.latestAgentTokenPlaintext);
    showToast(t("agentTokenCreated"));
    form.reset();
    await loadAgentTokens();
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
    showToast(t("monthlyReviewGenerated"));
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
          <span class="mini-bar-value">${renderMoneyWithUnit(formatSignedMoney(row.value), formatCurrencyUnit(base))}</span>
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
        ? `${t("trendModeNetWorth")}: ${formatSignedMoney(last)} ${formatCurrencyUnit(base)}`
        : `${t("trendModeExpense")}: ${formatMoney(last)} ${formatCurrencyUnit(base)}`;
  }
}

function renderHeroSummary(dashboard) {
  const base = dashboard.base_currency || state.settings?.base_currency || "USD";
  const netWorth = Number(dashboard.net_worth || 0);
  const runway = dashboard.runway_months;
  const runwayLabel = Number.isFinite(Number(runway)) ? `${Number(runway).toFixed(1)}m` : "∞";

  const heroValueEl = $("#heroNetWorthValue");
  if (heroValueEl) {
    const currencyHint = t("heroCurrencyToggleHint");
    heroValueEl.innerHTML = `<span class="hero-value-amount">${escapeHtml(
      formatMoneyMasked(netWorth)
    )}</span><span class="hero-value-unit hero-value-unit-toggle" role="button" tabindex="0" title="${escapeHtml(
      currencyHint
    )}" aria-label="${escapeHtml(currencyHint)}">${escapeHtml(formatCurrencyUnit(base))}</span>`;
  }
  renderHeroPrivacyToggleControl();
  renderAccountComposition(dashboard);

  $("#heroSubMetrics").innerHTML = `
    <div class="hero-subcard"><div class="k">${t("metricMonthlyIncome")}</div><div class="v">${renderMoneyWithUnit(formatMoney(dashboard.monthly_income), formatCurrencyUnit(base))}</div></div>
    <div class="hero-subcard"><div class="k">${t("metricMonthlyExpense")}</div><div class="v">${renderMoneyWithUnit(formatMoney(dashboard.monthly_expense), formatCurrencyUnit(base))}</div></div>
    <div class="hero-subcard"><div class="k">${t("metricNetCashFlow")}</div><div class="v">${renderMoneyWithUnit(formatSignedMoney(dashboard.net_cash_flow), formatCurrencyUnit(base))}</div></div>
    <div class="hero-subcard secondary"><div class="k">${t("metricRunwayMonths")}</div><div class="v">${runwayLabel}</div></div>
  `;
}

function toggleHeroCompositionLegendMode() {
  state.ui.accountCompositionPercent = !Boolean(state.ui.accountCompositionPercent);
  persistUiState();
  syncHeroCompositionToggleControl();
  if (state.dashboard) {
    renderAccountComposition(state.dashboard);
  }
}

function toggleAmountPrivacyVisibility() {
  state.ui.hideSensitiveAmounts = !Boolean(state.ui.hideSensitiveAmounts);
  persistUiState();
  renderHeroPrivacyToggleControl();
  if (state.dashboard) {
    renderHeroSummary(state.dashboard);
    renderInfographics(state.dashboard);
  }
  renderDashboardAccountsCard();
  renderAccounts();
}

function renderAccountComposition(dashboard) {
  const bar = $("#heroCompositionBar");
  const legend = $("#heroCompositionLegend");
  if (!bar || !legend) return;
  syncHeroCompositionToggleControl();
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
  const accountCurrencyById = new Map(
    (state.accounts || []).map((account) => [
      String(account.id),
      resolveCurrencyForDisplay(account.currency, dashboard.base_currency || state.settings?.base_currency || "USD")
    ])
  );
  const showPercent = Boolean(state.ui.accountCompositionPercent);
  legend.innerHTML = segments
    .map((row, index) => {
      const color = palette[index % palette.length];
      const label = row.name || row.type || "Account";
      let amountStr;
      if (showPercent) {
        const percent = total > 0 ? (Number(row.amount_base || 0) / total) * 100 : 0;
        amountStr = `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(percent)}%`;
      } else {
        const fmt = (n) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n);
        if (row.account_id === "other") {
          const base = dashboard.base_currency || state.settings?.base_currency || "USD";
          amountStr = `${fmt(row.amount_base)} ${formatCurrencyUnit(base)}`;
        } else if (row.balance !== undefined && row.balance !== null) {
          const base = dashboard.base_currency || state.settings?.base_currency || "USD";
          const currency = resolveCurrencyForDisplay(
            row.currency || accountCurrencyById.get(String(row.account_id)),
            base
          );
          amountStr = `${fmt(row.balance)} ${formatCurrencyUnit(currency)}`;
        } else {
          const base = dashboard.base_currency || state.settings?.base_currency || "USD";
          amountStr = `${fmt(row.amount_base)} ${formatCurrencyUnit(base)}`;
        }
      }
      amountStr = maskedAmountText(amountStr);
      return `<span class="hero-legend-item"><span class="hero-legend-dot" style="background:${color};"></span>${escapeHtml(label)} · ${amountStr}</span>`;
    })
    .join("");
}

function renderPlannedBudgetCard(dashboard) {
  const hasSpent = (row) => Number(row?.spent_amount || 0) > 0;
  const monthlyRows = (dashboard.budget_status || []).filter((row) => hasSpent(row));
  const yearlyRows = (dashboard.budget_status_yearly || []).filter((row) => hasSpent(row));
  const summary = $("#budgetPlanSummary");
  const list = $("#budgetPlanList");
  const pieView = $("#budgetPlanPieView");
  const card = document.querySelector('[data-sort-id="budgetPlanCard"]');
  if (!summary || !list || !pieView) return;
  if (card) {
    card.classList.toggle("hidden", monthlyRows.length === 0 && yearlyRows.length === 0);
  }

  const showPie = Boolean(state.ui.budgetPieView);
  document.querySelectorAll("#budgetViewTabs .acct-period-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === (showPie ? "pie" : "list"));
  });

  if (!monthlyRows.length && !yearlyRows.length) {
    summary.classList.remove("hidden");
    summary.textContent = t("emptyNoBudgetMonth");
    list.innerHTML = "";
    pieView.classList.add("hidden");
    list.classList.remove("hidden");
    return;
  }
  summary.textContent = "";
  summary.classList.add("hidden");

  const renderRows = (rows, periodLabel) =>
    [...rows]
      .sort((a, b) => Number(b.spent_amount || 0) - Number(a.spent_amount || 0))
      .map((row) => {
        const total = Number(row.total_amount || 0);
        const used = Number(row.spent_amount || 0);
        const remaining = Number(
          row.remaining_amount !== undefined && row.remaining_amount !== null ? row.remaining_amount : total - used
        );
        const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
        const ratio = total > 0 ? used / total : 0;
        const tone = ratio >= 1 ? "overspend" : ratio >= 0.8 ? "warn" : "normal";
        const remainClass = remaining < 0 || row.overspend ? "overspend" : "muted";
        const remainText = remaining < 0 ? `-${formatMoney(Math.abs(remaining))}` : formatMoney(remaining);
        const scope = row.year !== undefined ? "yearly" : "monthly";
        const period = scope === "yearly" ? String(row.year) : String(row.month || state.month);
        const l1Display = withL1Emoji(row.category_l1, {
          localizeDefault: true,
          isDefault: Boolean(state.categories?.[row.category_l1]?.is_default)
        });
        return `
          <article class="budget-plan-row clickable" data-action="edit-budget" data-scope="${scope}" data-period="${escapeHtml(period)}" data-category="${escapeHtml(row.category_l1)}" data-amount="${total}">
            <div class="top">
              <span class="budget-plan-name">
                <strong>${escapeHtml(l1Display)}</strong>
                <span class="budget-plan-period-chip">/ ${escapeHtml(periodLabel)}</span>
              </span>
              <span class="budget-plan-amounts ${row.overspend ? "overspend" : ratio >= 0.8 ? "warn" : "muted"}">
                ${formatMoney(used)}<span class="budget-plan-total"> / ${formatMoney(total)}</span>
              </span>
            </div>
            <div class="budget-plan-bottom">
              <div class="progress-wrap"><div class="progress-fill ${tone}" style="width:${pct}%"></div></div>
              <span class="budget-plan-remaining ${remainClass}">${remaining >= 0 ? escapeHtml(t("remaining")) + ": " + remainText : "−" + formatMoney(Math.abs(remaining))}</span>
            </div>
          </article>
        `;
      })
      .join("");

  const monthlyBlock = renderRows(monthlyRows, t("periodMonthly"));
  const yearlyBlock = renderRows(yearlyRows, t("periodYearly"));
  list.innerHTML = `${monthlyBlock}${yearlyBlock}`;
  pieView.innerHTML = renderBudgetPieView(monthlyRows, yearlyRows, dashboard.base_currency || state.settings?.base_currency || "USD");
  list.classList.toggle("hidden", showPie);
  pieView.classList.toggle("hidden", !showPie);
}

function renderBudgetPieView(monthlyRows, yearlyRows, baseCurrency) {
  const palette = ["#3f8059", "#b28a61", "#d38f53", "#8f6d4f", "#b55b52", "#6f8e9b", "#7b6aa9"];
  const entries = [
    ...monthlyRows.map((row) => ({ ...row, period: t("periodMonthly") })),
    ...yearlyRows.map((row) => ({ ...row, period: t("periodYearly") }))
  ]
    .map((row) => ({
      label: `${withL1Emoji(row.category_l1)} / ${row.period}`,
      spent: Math.max(0, Number(row.spent_amount || 0))
    }))
    .filter((row) => row.spent > 0);

  if (!entries.length) {
    return `<div class="list-row muted">${escapeHtml(t("budgetPieEmpty"))}</div>`;
  }

  entries.sort((a, b) => b.spent - a.spent);
  const maxSegments = 6;
  const top = entries.slice(0, maxSegments);
  const otherSum = entries.slice(maxSegments).reduce((sum, row) => sum + row.spent, 0);
  const segments = [...top];
  if (otherSum > 0.01) {
    segments.push({ label: t("budgetPieOther"), spent: otherSum });
  }
  const total = segments.reduce((sum, row) => sum + row.spent, 0);
  if (total <= 0) {
    return `<div class="list-row muted">${escapeHtml(t("budgetPieEmpty"))}</div>`;
  }

  let cursor = 0;
  const gradientStops = segments
    .map((row, index) => {
      const pct = (row.spent / total) * 100;
      const start = cursor;
      cursor += pct;
      const color = palette[index % palette.length];
      return `${color} ${start.toFixed(3)}% ${cursor.toFixed(3)}%`;
    })
    .join(", ");

  const legend = segments
    .map((row, index) => {
      const color = palette[index % palette.length];
      const pct = ((row.spent / total) * 100).toFixed(1);
      return `
        <article class="budget-pie-row">
          <div class="budget-pie-row-main">
            <span class="budget-pie-dot" style="background:${color};"></span>
            <span>${escapeHtml(row.label)}</span>
          </div>
          <span class="mono muted">${pct}% · ${formatMoney(row.spent)} ${escapeHtml(formatCurrencyUnit(baseCurrency))}</span>
        </article>
      `;
    })
    .join("");

  return `
    <div class="budget-pie-layout">
      <div class="budget-pie-chart" style="background: conic-gradient(${gradientStops});">
        <div class="budget-pie-center">
          <strong>${formatMoney(total)}</strong>
          <span>${escapeHtml(t("budgetPieCenterLabel"))} · ${escapeHtml(formatCurrencyUnit(baseCurrency))}</span>
        </div>
      </div>
      <div class="budget-pie-legend">${legend}</div>
    </div>
  `;
}


function renderAccounts() {
  const target = $("#accountList");
  if (!state.accounts.length) {
    target.innerHTML = '<div class="list-row muted" style="padding:16px;text-align:center">No accounts yet. Create one above.</div>';
    return;
  }
  target.innerHTML = state.accounts
    .map((row) => {
      const icon = accountTypeEmoji(row.type);
      const label = accountTypeLabel(row.type);
      const accountCurrency = resolveCurrencyForDisplay(
        row.currency,
        state.settings?.base_currency || "USD"
      );
      const bal = maskedAmountText(formatMoney(row.balance));
      const isNeg = Number(row.balance) < 0;
      return `
      <article class="list-row clickable account-list-row" data-action="edit-account" data-id="${row.id}">
        <div class="account-row-inner">
          <span class="account-type-icon">${icon}</span>
          <div class="account-info">
            <span class="account-name">${escapeHtml(row.name)}</span>
            <span class="account-meta muted">${escapeHtml(label)} · ${escapeHtml(
              formatCurrencyUnit(accountCurrency)
            )}</span>
          </div>
          <span class="account-balance mono${isNeg ? " overspend" : ""}">${bal}</span>
        </div>
      </article>`;
    })
    .join("");
}

function renderDashboardAccountsCard() {
  const target = $("#dashboardAccountsList");
  if (!target) return;
  const accounts = state.accounts || [];
  if (!accounts.length) {
    target.innerHTML = '<div class="muted" style="padding:8px 0;text-align:center;font-size:0.875rem">No accounts</div>';
    return;
  }
  const baseCurrency = ensureUICurrency(state.settings?.base_currency || "USD");
  const txs = state.accountPeriodTxs || [];
  const fmt = (n) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n);
  target.innerHTML = accounts.map((row) => {
    const icon = accountTypeEmoji(row.type);
    const isNeg = Number(row.balance) < 0;
    const accountCurrency = resolveCurrencyForDisplay(row.currency, baseCurrency);
    let net = 0;
    for (const tx of txs) {
      const amt = Number(tx.amount_base || 0);
      if ((tx.type === "income" || tx.type === "transfer") && tx.account_to_id === row.id) net += amt;
      if ((tx.type === "expense" || tx.type === "transfer") && tx.account_from_id === row.id) net -= amt;
    }
    let deltaHtml = "";
    if (net !== 0) {
      const sign = net > 0 ? "+" : "";
      const cls = net > 0 ? "acct-delta-in" : "acct-delta-out";
      deltaHtml = `<span class="acct-delta ${cls}">${renderMoneyWithUnit(
        `${sign}${fmt(net)}`,
        formatCurrencyUnit(baseCurrency)
      )}</span>`;
    }
    return `
    <div class="account-dash-row clickable" data-action="edit-account" data-id="${row.id}">
      <span class="account-type-icon">${icon}</span>
      <span class="account-name">${escapeHtml(row.name)}</span>
      <div class="acct-right">
        <span class="account-balance mono${isNeg ? " overspend" : ""}">${renderMoneyWithUnit(
          fmt(row.balance),
          formatCurrencyUnit(accountCurrency)
        )}</span>
        ${deltaHtml}
      </div>
    </div>`;
  }).join("");
}

function openAccountEditSheet(accountId) {
  const account = (state.accounts || []).find((row) => row.id === accountId);
  if (!account) {
    showToast(t("accountNotFound"), true);
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

function openBudgetEditSheet(scope, period, category_l1, totalAmount) {
  const form = $("#budgetEditForm");
  if (!(form instanceof HTMLFormElement)) return;
  form.elements.scope.value = scope;
  form.elements.period.value = period;
  form.elements.category_l1_orig.value = category_l1;
  form.elements.scope_display.value = scope === "yearly" ? t("periodYearly") : t("periodMonthly");
  form.elements.period_display.value = period;
  form.elements.category_display.value = withL1Emoji(category_l1);
  form.elements.total_amount.value = String(totalAmount);
  openSheet("budgetEditSheet", { preserveUtility: true });
}

async function submitBudgetEditForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!(form instanceof HTMLFormElement)) return;
  const fd = new FormData(form);
  const scope = String(fd.get("scope") || "");
  const period = String(fd.get("period") || "");
  const category_l1 = String(fd.get("category_l1_orig") || "");
  const total_amount = Number(fd.get("total_amount"));
  if (!Number.isFinite(total_amount) || total_amount < 0) { showToast(t("invalidAmount"), true); return; }
  try {
    if (total_amount === 0) {
      // Treat 0 as "remove budget"
      if (scope === "yearly") {
        await api("/api/v1/budgets/yearly", { method: "DELETE", body: JSON.stringify({ year: Number(period), category_l1 }) });
      } else {
        await api("/api/v1/budgets", { method: "DELETE", body: JSON.stringify({ month: period, category_l1 }) });
      }
    } else if (scope === "yearly") {
      await api("/api/v1/budgets/yearly", { method: "POST", body: JSON.stringify({ year: Number(period), category_l1, total_amount }) });
    } else {
      await api("/api/v1/budgets", { method: "POST", body: JSON.stringify({ month: period, category_l1, total_amount }) });
    }
    showToast(t("budgetUpdated"));
    closeSheet("budgetEditSheet");
    try { await Promise.all([loadBudgets(), loadYearlyBudgets(), loadDashboard()]); } catch (e) { showRefreshFailureToast(e); }
  } catch (error) { showErrorToast(error); }
}

async function deleteBudget() {
  const form = $("#budgetEditForm");
  if (!(form instanceof HTMLFormElement)) return;
  const scope = String(form.elements.scope.value || "");
  const period = String(form.elements.period.value || "");
  const category_l1 = String(form.elements.category_l1_orig.value || "");
  try {
    if (scope === "yearly") {
      await api("/api/v1/budgets/yearly", { method: "DELETE", body: JSON.stringify({ year: Number(period), category_l1 }) });
    } else {
      await api("/api/v1/budgets", { method: "DELETE", body: JSON.stringify({ month: period, category_l1 }) });
    }
    showToast(t("budgetUpdated"));
    closeSheet("budgetEditSheet");
    try { await Promise.all([loadBudgets(), loadYearlyBudgets(), loadDashboard()]); } catch (e) { showRefreshFailureToast(e); }
  } catch (error) { showErrorToast(error); }
}

async function submitBudgetInlineForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!(form instanceof HTMLFormElement)) return;
  const fd = new FormData(form);
  const scope = String(fd.get("scope") || "monthly");
  const category_l1 = String(fd.get("category_l1") || "");
  const total_amount = Number(fd.get("total_amount"));
  if (!category_l1 || !total_amount || !Number.isFinite(total_amount)) { showToast(t("invalidAmount"), true); return; }
  try {
    if (scope === "yearly") {
      const year = Number(fd.get("year"));
      await api("/api/v1/budgets/yearly", { method: "POST", body: JSON.stringify({ year, category_l1, total_amount }) });
    } else {
      const month = String(fd.get("month") || state.month);
      await api("/api/v1/budgets", { method: "POST", body: JSON.stringify({ month, category_l1, total_amount }) });
    }
    showToast(t("budgetUpdated"));
    form.reset();
    $("#budgetCreateWrap")?.classList.add("hidden");
    const monthInput = form.elements.month;
    if (monthInput) monthInput.value = state.month;
    const yearInput = form.elements.year;
    if (yearInput) yearInput.value = String(new Date().getFullYear());
    try { await Promise.all([loadBudgets(), loadYearlyBudgets(), loadDashboard()]); } catch (e) { showRefreshFailureToast(e); }
  } catch (error) { showErrorToast(error); }
}

async function getLinkedTransactionCount(accountId) {
  try {
    const usage = await api(`/api/v1/accounts/${accountId}/usage`);
    return Number(usage?.linked_transactions || 0);
  } catch {
    return 0;
  }
}

function getTransactionById(transactionId) {
  return (state.transactions || []).find((row) => row.id === transactionId) || null;
}

function openTransactionDetailSheet(transactionId) {
  const tx = getTransactionById(transactionId);
  if (!tx) {
    showToast(t("transactionNotFound"), true);
    return;
  }
  state.detailTransactionId = transactionId;
  populateTransactionDetailSheet(tx);
  openSheet("transactionDetailSheet", { preserveUtility: true });
}

function populateTransactionDetailSheet(tx) {
  const baseCurrency = String(state.settings?.base_currency || "USD").toUpperCase();
  const sourceCurrency = String(tx.currency_original || baseCurrency).toUpperCase();
  const originalAmount = getSignedTransactionAmount(tx, "amount_original");
  const baseAmount = getSignedTransactionAmount(tx, "amount_base");
  const hero = document.getElementById("txdHero");
  if (hero) {
    hero.dataset.type = tx.type || "expense";
  }
  const amountEl = document.getElementById("transactionDetailAmountValue");
  if (amountEl) {
    amountEl.innerHTML = `${escapeHtml(formatSignedMoney(originalAmount))}<span class="txd-amount-currency">${escapeHtml(
      formatCurrencyUnit(sourceCurrency)
    )}</span>`;
  }
  const subEl = document.getElementById("transactionDetailAmountSub");
  if (subEl) {
    subEl.textContent =
      sourceCurrency === baseCurrency
        ? ""
        : `${formatSignedMoney(baseAmount)} ${formatCurrencyUnit(baseCurrency)}`;
  }
  setText("transactionDetailCategoryValue", formatTransactionDetailCategory(tx));
  setText("transactionDetailAccountValue", formatTransactionDetailAccount(tx));
  const detailTime = formatTransactionDetailTime(tx);
  setText("transactionDetailTimeValue", detailTime.primary);
  setText("transactionDetailCreatedSub", detailTime.secondary);
}

function getSignedTransactionAmount(tx, fieldName) {
  const amount = Number(tx?.[fieldName] || 0);
  if (tx?.type === "expense") return -Math.abs(amount);
  if (tx?.type === "income") return Math.abs(amount);
  return amount;
}

function formatTransactionDetailCategory(tx) {
  if (tx?.type === "expense") {
    return tx.category_l2 ? withL2Emoji(tx.category_l2, tx.category_l1) : "-";
  }
  if (tx?.type === "transfer") {
    return getTransferReasonLabel(tx.transfer_reason || "normal");
  }
  if (tx?.type === "income") {
    return txTypeLabel("income");
  }
  return "-";
}

function formatTransactionDetailAccount(tx) {
  if (tx?.type === "expense") {
    return getAccountDisplayName(tx.account_from_id);
  }
  if (tx?.type === "income") {
    return getAccountDisplayName(tx.account_to_id);
  }
  if (tx?.type === "transfer") {
    return `${getAccountDisplayName(tx.account_from_id)} → ${getAccountDisplayName(tx.account_to_id)}`;
  }
  return "-";
}

function formatTransactionDetailTime(tx) {
  const txDate = String(tx?.tx_date || "-");
  const createdAt = formatTimestampValue(tx?.created_at);
  if (!createdAt || createdAt.startsWith(txDate)) {
    return { primary: txDate, secondary: "" };
  }
  return {
    primary: txDate,
    secondary: t("transactionDetailCreatedAt", { time: createdAt })
  };
}

function getAccountDisplayName(accountId) {
  const id = Number(accountId || 0);
  if (!Number.isInteger(id) || id <= 0) return "-";
  const account = (state.accounts || []).find((row) => row.id === id);
  if (!account) return `#${id}`;
  return `${account.name} · ${account.type}`;
}

function openCurrentDetailForEdit() {
  const txId = Number(state.detailTransactionId || 0);
  if (!Number.isInteger(txId) || txId <= 0) return;
  closeSheet("transactionDetailSheet");
  openTransactionEditSheet(txId);
}

function openTransactionEditSheet(transactionId) {
  const tx = getTransactionById(transactionId);
  if (!tx) {
    showToast(t("transactionNotFound"), true);
    return;
  }
  state.editingTransactionId = transactionId;
  const form = $("#transactionEditForm");
  if (!(form instanceof HTMLFormElement)) return;
  populateTransactionEditL1Select();
  populateTransactionEditAccountSelects();
  form.elements.transaction_id.value = String(tx.id);
  form.elements.type.value = String(tx.type || "expense");
  form.elements.date.value = String(tx.tx_date || new Date().toISOString().slice(0, 10));
  form.elements.amount_original.value = String(Number(tx.amount_original || 0));
  form.elements.currency_original.value = ensureUICurrency(tx.currency_original || "USD");
  form.elements.fx_rate.value = Number(tx.fx_rate || 0) > 0 ? String(Number(tx.fx_rate)) : "";
  form.elements.category_l1.value = tx.category_l1 || "";
  populateTransactionEditL2Select();
  form.elements.category_l2.value = tx.category_l2 || "";
  form.elements.account_from_id.value = tx.account_from_id ? String(tx.account_from_id) : "";
  form.elements.account_to_id.value = tx.account_to_id ? String(tx.account_to_id) : "";
  form.elements.transfer_reason.value = tx.transfer_reason || "normal";
  form.elements.note.value = tx.note || "";
  form.elements.tags.value = Array.isArray(tx.tags) ? tx.tags.join(", ") : "";
  handleTransactionEditTypeChange();
  openSheet("transactionEditSheet", { preserveUtility: true });
}

function buildTransactionPayloadFromForm(formData) {
  const type = String(formData.get("type") || "");
  const transferReason = String(formData.get("transfer_reason") || "normal");
  const transferConfig = getTransferReasonConfig(transferReason);
  const fxRaw = String(formData.get("fx_rate") || "").trim();
  const payload = {
    date: String(formData.get("date") || ""),
    type,
    amount_original: Number(formData.get("amount_original")),
    currency_original: ensureUICurrency(String(formData.get("currency_original") || "USD")),
    note: formData.get("note") || "",
    tags: String(formData.get("tags") || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
  };
  if (fxRaw) payload.fx_rate = Number(fxRaw);
  if (type === "expense") {
    payload.category_l1 = String(formData.get("category_l1") || "");
    payload.category_l2 = String(formData.get("category_l2") || "");
    payload.account_from_id = parseOptionalInt(formData.get("account_from_id"));
  } else if (type === "income") {
    payload.account_to_id = parseOptionalInt(formData.get("account_to_id"));
  } else if (type === "transfer") {
    payload.account_from_id = transferConfig.needsFrom ? parseOptionalInt(formData.get("account_from_id")) : undefined;
    payload.account_to_id = transferConfig.needsTo ? parseOptionalInt(formData.get("account_to_id")) : undefined;
    payload.transfer_reason = transferReason;
  }
  return payload;
}

async function submitTransactionEditForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!(form instanceof HTMLFormElement)) return;
  const fd = new FormData(form);
  const txId = Number(fd.get("transaction_id"));
  if (!Number.isInteger(txId) || txId <= 0) {
    showToast(t("invalidTransactionId"), true);
    return;
  }
  const payload = buildTransactionPayloadFromForm(fd);
  try {
    await api(`/api/v1/transactions/${txId}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
    showToast(t("transactionUpdated"));
    try {
      await refreshAfterLedgerChange();
      closeSheet("transactionEditSheet");
      state.editingTransactionId = null;
    } catch (error) {
      showRefreshFailureToast(error);
    }
  } catch (error) {
    showErrorToast(error);
  }
}

async function deleteCurrentTransaction() {
  const txId = Number(state.editingTransactionId || 0);
  if (!Number.isInteger(txId) || txId <= 0) return;
  await deleteTransactionById(txId, { closeEditSheet: true });
}

async function deleteCurrentDetailTransaction() {
  const txId = Number(state.detailTransactionId || 0);
  if (!Number.isInteger(txId) || txId <= 0) return;
  await deleteTransactionById(txId, { closeDetailSheet: true });
}

async function deleteTransactionById(txId, options = {}) {
  if (!window.confirm(t("transactionDeleteConfirm"))) return;
  try {
    await api(`/api/v1/transactions/${txId}`, { method: "DELETE" });
    showToast(t("transactionDeleted"));
    if (state.editingTransactionId === txId) state.editingTransactionId = null;
    if (state.detailTransactionId === txId) state.detailTransactionId = null;
    if (options.closeEditSheet) closeSheet("transactionEditSheet");
    if (options.closeDetailSheet) closeSheet("transactionDetailSheet");
    try {
      await refreshAfterLedgerChange();
    } catch (error) {
      showRefreshFailureToast(error);
    }
  } catch (error) {
    showErrorToast(error);
  }
}

function renderAgentTokens() {
  const target = $("#agentTokenList");
  if (!target) return;
  const rows = (Array.isArray(state.agentTokens) ? state.agentTokens : []).filter(
    (row) => row && !row.revoked
  );
  if (!rows.length) {
    target.innerHTML = `<div class="list-row muted">${escapeHtml(t("tokenListEmpty"))}</div>`;
    return;
  }
  target.innerHTML = rows
    .map((row) => {
      const scopes = Array.isArray(row.scopes) ? row.scopes.join(", ") : "";
      const lastUsed = row.last_used_at ? formatTimestampValue(row.last_used_at) : t("tokenNeverUsed");
      return `
        <article class="list-row">
          <div class="row-main">
            <strong>${escapeHtml(row.name || "")}</strong>
            <span class="pill">${escapeHtml(t("tokenStatusActive"))}</span>
          </div>
          <div class="muted mono">${escapeHtml(row.token_masked || row.token_prefix || "")}</div>
          <div class="muted">${escapeHtml(t("tokenScopes"))}: ${escapeHtml(scopes || "-")}</div>
          <div class="muted">${escapeHtml(t("tokenLastUsed"))}: ${escapeHtml(lastUsed)}</div>
          <div class="tag-wrap">
            <button class="btn" data-action="revoke" data-id="${row.id}">${escapeHtml(t("revokeToken"))}</button>
          </div>
        </article>
      `;
    })
    .join("");
}

async function loadTransactions(options = {}) {
  return loadTransactionsWithOptions(options);
}

function normalizeTransactionFilterDate(value) {
  const text = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

function syncTransactionFiltersFromInputs() {
  const tagInput = $("#transactionTagFilter");
  const typeSelect = $("#transactionTypeFilter");
  const categorySelect = $("#transactionCategoryFilter");
  const startInput = $("#transactionStartFilter");
  const endInput = $("#transactionEndFilter");
  state.txFilters.tag = tagInput instanceof HTMLInputElement ? tagInput.value.trim() : "";
  state.txFilters.type =
    typeSelect instanceof HTMLSelectElement ? String(typeSelect.value || "").trim().toLowerCase() : "";
  state.txFilters.categoryL1 =
    categorySelect instanceof HTMLSelectElement ? String(categorySelect.value || "").trim() : "";
  state.txFilters.start = startInput instanceof HTMLInputElement ? normalizeTransactionFilterDate(startInput.value) : "";
  state.txFilters.end = endInput instanceof HTMLInputElement ? normalizeTransactionFilterDate(endInput.value) : "";
}

function applyTransactionFiltersToInputs() {
  const tagInput = $("#transactionTagFilter");
  if (tagInput instanceof HTMLInputElement) {
    tagInput.value = String(state.txFilters.tag || "");
  }
  const typeSelect = $("#transactionTypeFilter");
  if (typeSelect instanceof HTMLSelectElement) {
    const nextType = String(state.txFilters.type || "");
    typeSelect.value = ["expense", "income", "transfer"].includes(nextType) ? nextType : "";
  }
  const categorySelect = $("#transactionCategoryFilter");
  if (categorySelect instanceof HTMLSelectElement) {
    const nextCategory = String(state.txFilters.categoryL1 || "");
    const hasOption = Array.from(categorySelect.options).some((option) => option.value === nextCategory);
    categorySelect.value = hasOption ? nextCategory : "";
  }
  const startInput = $("#transactionStartFilter");
  if (startInput instanceof HTMLInputElement) {
    startInput.value = normalizeTransactionFilterDate(state.txFilters.start);
  }
  const endInput = $("#transactionEndFilter");
  if (endInput instanceof HTMLInputElement) {
    endInput.value = normalizeTransactionFilterDate(state.txFilters.end);
  }
}

function resetTransactionFilters() {
  state.txFilters = {
    tag: "",
    type: "",
    categoryL1: "",
    start: "",
    end: ""
  };
  applyTransactionFiltersToInputs();
}

function populateTransactionFilterCategorySelect() {
  const select = $("#transactionCategoryFilter");
  if (!(select instanceof HTMLSelectElement)) return;
  const currentValue = String(state.txFilters?.categoryL1 || select.value || "").trim();
  const activeL1 = Object.entries(state.categories || {}).filter(([, cfg]) => cfg.active);
  select.innerHTML = "";
  const allOption = new Option(t("txFilterAllCategories"), "");
  allOption.id = "transactionCategoryFilterAllOption";
  select.appendChild(allOption);
  for (const [name, cfg] of activeL1) {
    select.appendChild(new Option(withL1Emoji(name, { bilingualDefault: true, isDefault: Boolean(cfg?.is_default) }), name));
  }
  const nextValue = activeL1.some(([name]) => name === currentValue) ? currentValue : "";
  state.txFilters.categoryL1 = nextValue;
  select.value = nextValue;
}

async function loadTransactionsWithOptions(options = {}) {
  const expenseOnly =
    typeof options.expenseOnly === "boolean" ? options.expenseOnly : isTransactionRecordsOnlyMode();
  const params = new URLSearchParams();
  const start = normalizeTransactionFilterDate(state.txFilters?.start);
  const end = normalizeTransactionFilterDate(state.txFilters?.end);
  if (start || end) {
    if (start) params.set("start", start);
    if (end) params.set("end", end);
  } else {
    params.set("month", state.month);
  }
  const tag = String(state.txFilters?.tag || "").trim();
  if (tag) params.set("tag", tag);
  const type = String(state.txFilters?.type || "").trim().toLowerCase();
  if (["expense", "income", "transfer"].includes(type)) params.set("type", type);
  const categoryL1 = String(state.txFilters?.categoryL1 || "").trim();
  if (categoryL1) params.set("category_l1", categoryL1);
  const path = `/api/v1/transactions?${params.toString()}`;
  const rows = await api(path);
  state.transactions = Array.isArray(rows) ? rows : [];
  if (!expenseOnly) {
    renderRecentExpensesCard(state.transactions);
    renderTodayExpensesCard(state.transactions);
    renderRecentCompareCard(state.recentCompareRows || []);
  }
  renderTransactionList(state.transactions, { expenseOnly });
  return state.transactions;
}

async function loadRecentCompareData() {
  const range = getRecentCompareRange();
  const rows = await api(`/api/v1/transactions?start=${range.start}&end=${range.end}`);
  state.recentCompareRows = Array.isArray(rows) ? rows : [];
  renderRecentCompareCard(state.recentCompareRows);
  renderRecentExpensesSummaryBar(state.transactions || [], state.recentCompareRows);
  return state.recentCompareRows;
}

function renderRecentCompareCard(rows) {
  const summaryEl = $("#recentCompareSummary");
  const stateEl = $("#recentCompareState");
  const rangeEl = $("#recentCompareRange");
  const chartEl = $("#recentCompareChart");
  const axisEl = $("#recentCompareAxis");
  if (!summaryEl || !stateEl || !rangeEl || !chartEl || !axisEl) return;
  const base = state.settings?.base_currency || state.dashboard?.base_currency || "USD";
  const model = buildRecentCompareModel(rows);
  summaryEl.textContent = model.summary;
  stateEl.textContent = model.stateLabel;
  rangeEl.textContent = model.rangeLabel;
  const chartMeta = renderRecentCompareChart(chartEl, model.series, {
    upperBound: model.upperBoundDaily
  });
  const chartShellEl = chartEl.closest(".recent-compare-chart-shell");
  if (chartShellEl && chartMeta) {
    chartShellEl.style.setProperty("--recent-risk-split", `${chartMeta.splitPercent.toFixed(2)}%`);
    chartShellEl.classList.toggle("recent-compare-chart-shell--insufficient", !chartMeta.hasUpperBound);
  }
  axisEl.innerHTML = model.series
    .map((point) => `<span>${escapeHtml(point.weekday)}</span>`)
    .join("");
}

function buildRecentCompareModel(rows) {
  const base = state.settings?.base_currency || state.dashboard?.base_currency || "USD";
  const totals = new Map();
  for (const tx of Array.isArray(rows) ? rows : []) {
    if (!tx || tx.type !== "expense") continue;
    const dateKey = String(tx.tx_date || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) continue;
    const amount = Math.abs(Number(tx.amount_base || 0));
    if (!Number.isFinite(amount) || amount <= 0) continue;
    totals.set(dateKey, (totals.get(dateKey) || 0) + amount);
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const mondayOffset = (today.getDay() + 6) % 7;
  const startDate = addDaysLocal(today, -mondayOffset);
  const endDate = addDaysLocal(startDate, 6);
  const series = [];
  for (let i = 0; i < 7; i += 1) {
    const day = addDaysLocal(startDate, i);
    const prevDay = addDaysLocal(day, -7);
    const dayKey = formatDateOnlyLocal(day);
    const prevKey = formatDateOnlyLocal(prevDay);
    series.push({
      day,
      hasRecord: totals.has(dayKey),
      value: Number((totals.get(dayKey) || 0).toFixed(2)),
      previous: Number((totals.get(prevKey) || 0).toFixed(2)),
      weekday: t(getRecentCompareWeekdayKey(day))
    });
  }

  const elapsedDays = Math.min(7, Math.max(1, mondayOffset + 1));
  const elapsedSeries = series.slice(0, elapsedDays);
  const totalCurrent = Number(elapsedSeries.reduce((sum, row) => sum + row.value, 0).toFixed(2));
  const totalPrevious = Number(series.reduce((sum, row) => sum + row.previous, 0).toFixed(2));
  const previousDays = series.map((row) => Number(row.previous || 0));
  const previousMean = totalPrevious / series.length;
  const currentMean = totalCurrent / elapsedDays;
  const previousVariance =
    previousDays.reduce((sum, value) => sum + (value - previousMean) ** 2, 0) / series.length;
  const previousStd = Math.sqrt(previousVariance);
  const previousActiveDays = previousDays.filter((value) => value > 0.0001).length;
  const baselineSufficient = totalPrevious > 0.0001 && previousActiveDays >= 2;
  const dailyTolerance = baselineSufficient ? Math.max(previousMean * 0.25, previousStd * 0.9) : 0;
  const upperBoundDaily = baselineSufficient ? previousMean + dailyTolerance : null;
  const lowerBoundDaily = baselineSufficient ? Math.max(0, previousMean - dailyTolerance * 0.7) : null;
  let summary = "";
  let stateLabel = "";
  if (totalCurrent <= 0.0001) {
    summary = t("recentCompareSummaryQuiet");
    stateLabel = t("recentCompareStateQuiet");
  } else {
    const amountText = formatMoney(totalCurrent);
    const currencyText = formatCurrencyUnit(base);

    if (elapsedDays < 4) {
      const todayPoint = elapsedSeries[elapsedSeries.length - 1];
      const sameDayBaseline = Number(todayPoint?.previous || 0);
      const sameDayCurrent = Number(todayPoint?.value || 0);
      const weekdayText = todayPoint?.weekday || t("recentCompareAxisMon");

      if (sameDayBaseline <= 0.0001) {
        summary = t("recentCompareSummaryEarlyNoBaseline", {
          amount: amountText,
          currency: currencyText,
          weekday: weekdayText
        });
        stateLabel = t("recentCompareStateInsufficient");
      } else {
        const sameDayTolerance = Math.max(sameDayBaseline * 0.2, dailyTolerance || sameDayBaseline * 0.2);
        const pct = ((sameDayCurrent - sameDayBaseline) / sameDayBaseline) * 100;
        const pctAbs = `${Math.abs(pct).toFixed(1)}%`;
        const lower = Math.max(0, sameDayBaseline - sameDayTolerance);
        const upper = sameDayBaseline + sameDayTolerance;
        if (sameDayCurrent < lower - 0.0001) {
          summary = t("recentCompareSummaryEarlyDown", {
            amount: amountText,
            currency: currencyText,
            weekday: weekdayText,
            pct: pctAbs
          });
          stateLabel = t("recentCompareStateDown");
        } else if (sameDayCurrent > upper + 0.0001) {
          summary = t("recentCompareSummaryEarlyUp", {
            amount: amountText,
            currency: currencyText,
            weekday: weekdayText,
            pct: pctAbs
          });
          stateLabel = t("recentCompareStateUp");
        } else {
          summary = t("recentCompareSummaryEarlyFlat", {
            amount: amountText,
            currency: currencyText,
            weekday: weekdayText
          });
          stateLabel = t("recentCompareStateFlat");
        }
      }
    } else if (!baselineSufficient) {
      summary = t("recentCompareSummaryAvgInsufficient", {
        amount: amountText,
        currency: currencyText
      });
      stateLabel = t("recentCompareStateInsufficient");
    } else {
      const pct = previousMean > 0 ? ((currentMean - previousMean) / previousMean) * 100 : null;
      const pctAbs = pct === null ? null : `${Math.abs(pct).toFixed(1)}%`;
      if (currentMean < (lowerBoundDaily || 0) - 0.0001 && pct !== null) {
        summary = t("recentCompareSummaryAvgDown", {
          amount: amountText,
          currency: currencyText,
          pct: pctAbs
        });
        stateLabel = t("recentCompareStateDown");
      } else if (currentMean > (upperBoundDaily || 0) + 0.0001 && pct !== null) {
        summary = t("recentCompareSummaryAvgUp", {
          amount: amountText,
          currency: currencyText,
          pct: pctAbs
        });
        stateLabel = t("recentCompareStateUp");
      } else {
        summary = t("recentCompareSummaryAvgFlat", {
          amount: amountText,
          currency: currencyText
        });
        stateLabel = t("recentCompareStateFlat");
      }
    }
  }

  return {
    series,
    summary,
    stateLabel,
    rangeLabel: formatRecentCompareRange(startDate, endDate),
    upperBoundDaily
  };
}

function renderRecentCompareChart(svg, series, options = {}) {
  if (!(svg instanceof SVGElement) || !Array.isArray(series) || !series.length) {
    return { splitPercent: 38, hasUpperBound: false };
  }
  const viewportWidth = Math.max(
    320,
    Number(svg.clientWidth || (typeof svg.getBoundingClientRect === "function" ? svg.getBoundingClientRect().width : 0) || 620)
  );
  const viewportHeight = Math.max(
    132,
    Number(svg.clientHeight || (typeof svg.getBoundingClientRect === "function" ? svg.getBoundingClientRect().height : 0) || 132)
  );
  // Keep SVG coordinates 1:1 with rendered viewport, so marker circles never stretch into ellipses.
  const width = Math.round(viewportWidth);
  const height = Math.round(viewportHeight);
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  const padTop = 14;
  const padBottom = 24;
  const padX = 16;
  const current = series.map((row) => Number(row.value || 0));
  const hasData = series.map((row) => Boolean(row.hasRecord));
  const upperBoundValue = Number(options?.upperBound);
  const hasUpperBound = Number.isFinite(upperBoundValue) && upperBoundValue > 0;
  const max = Math.max(1, ...current, hasUpperBound ? upperBoundValue : 0);
  const stepX = (width - padX * 2) / Math.max(1, series.length - 1);
  const toY = (value) => {
    const ratio = Math.max(0, Math.min(1, value / max));
    return height - padBottom - ratio * (height - padTop - padBottom);
  };
  const points = current.map((value, idx) => {
    const x = padX + idx * stepX;
    const y = toY(value);
    return { x, y };
  });
  const upperY = hasUpperBound ? toY(upperBoundValue) : null;
  const splitPercentRaw = hasUpperBound ? (upperY / height) * 100 : 38;
  const splitPercent = Math.max(14, Math.min(86, splitPercentRaw));
  const lineSegments = [];
  const validPointCount = hasData.filter(Boolean).length;
  if (validPointCount >= 2) {
    for (let i = 0; i < points.length - 1; i += 1) {
      const left = points[i];
      const right = points[i + 1];
      const leftHas = hasData[i];
      const rightHas = hasData[i + 1];
      if (!leftHas && !rightHas) continue;
      if (leftHas && rightHas) {
        lineSegments.push(
          `<line class="recent-compare-line" x1="${left.x.toFixed(2)}" y1="${left.y.toFixed(2)}" x2="${right.x.toFixed(
            2
          )}" y2="${right.y.toFixed(2)}"></line>`
        );
        continue;
      }
      const midX = (left.x + right.x) / 2;
      const midY = (left.y + right.y) / 2;
      if (leftHas) {
        lineSegments.push(
          `<line class="recent-compare-line" x1="${left.x.toFixed(2)}" y1="${left.y.toFixed(2)}" x2="${midX.toFixed(
            2
          )}" y2="${midY.toFixed(2)}"></line>`
        );
      } else if (rightHas) {
        lineSegments.push(
          `<line class="recent-compare-line" x1="${midX.toFixed(2)}" y1="${midY.toFixed(2)}" x2="${right.x.toFixed(
            2
          )}" y2="${right.y.toFixed(2)}"></line>`
        );
      }
    }
  }
  const dots = points
    .map((point, idx) => {
      if (!hasData[idx]) return "";
      return `<circle class="recent-compare-dot" cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="8.4"></circle>`;
    })
    .join("");

  svg.innerHTML = `
    ${lineSegments.join("")}
    ${dots}
  `;
  return { splitPercent, hasUpperBound };
}

function formatRecentCompareRange(startDate, endDate) {
  const lang = ensureUILanguage(state.settings?.ui_language || "en");
  if (lang === "zh") {
    const sm = startDate.getMonth() + 1;
    const sd = startDate.getDate();
    const em = endDate.getMonth() + 1;
    const ed = endDate.getDate();
    if (sm === em) return `${sm}月${sd}-${ed}日`;
    return `${sm}月${sd}日 - ${em}月${ed}日`;
  }
  const monthFmt = new Intl.DateTimeFormat("en-US", { month: "short" });
  const sm = monthFmt.format(startDate).toUpperCase();
  const em = monthFmt.format(endDate).toUpperCase();
  const sd = startDate.getDate();
  const ed = endDate.getDate();
  if (sm === em) return `${sm} ${sd}-${ed}`;
  return `${sm} ${sd} - ${em} ${ed}`;
}

function getRecentCompareWeekdayKey(date) {
  const keys = [
    "recentCompareAxisSun",
    "recentCompareAxisMon",
    "recentCompareAxisTue",
    "recentCompareAxisWed",
    "recentCompareAxisThu",
    "recentCompareAxisFri",
    "recentCompareAxisSat"
  ];
  return keys[date.getDay()] || "recentCompareAxisMon";
}

function renderTransactionList(rows, options = {}) {
  const expenseOnly = Boolean(options.expenseOnly);
  const visibleRows = expenseOnly ? rows.filter((row) => row.type === "expense") : rows;
  const target = $("#transactionList");
  const baseCurrency = state.settings?.base_currency || "USD";
  if (!visibleRows.length) {
    target.innerHTML = `<div class="list-row muted">${escapeHtml(
      t(expenseOnly ? "emptyNoExpenseMonth" : "emptyNoTxMonth")
    )}</div>`;
    return;
  }
  target.innerHTML = visibleRows
    .map((row) => {
      const sourceCurrency = String(row.currency_original || baseCurrency).toUpperCase();
      const showOrig = sourceCurrency !== baseCurrency;
      const isExpense = row.type === "expense";
      const isIncome = row.type === "income";
      const isTransfer = row.type === "transfer";

      // title line
      let title = "";
      if (isExpense) title = formatCategoryPair(row.category_l1, row.category_l2) || txTypeLabel(row.type);
      else if (isIncome) title = `${txTypeLabel("income")}`;
      else {
        const reason = row.transfer_reason && row.transfer_reason !== "normal"
          ? ` · ${getTransferReasonLabel(row.transfer_reason)}` : "";
        title = `${txTypeLabel("transfer")}${reason}`;
      }

      // account line
      let accountLine = "";
      if (isExpense && row.account_from_id) accountLine = escapeHtml(row.account_from_id);
      else if (isIncome && row.account_to_id) accountLine = escapeHtml(row.account_to_id);
      else if (isTransfer) {
        const from = row.account_from_id || "–";
        const to = row.account_to_id || "–";
        accountLine = `${escapeHtml(from)} → ${escapeHtml(to)}`;
      }

      const amountClass = isExpense ? "tx-amount expense" : isIncome ? "tx-amount income" : "tx-amount transfer";
      const signedBase = isExpense ? -Math.abs(Number(row.amount_base)) : isIncome ? Math.abs(Number(row.amount_base)) : Number(row.amount_base);
      const signedOrig = isExpense ? -Math.abs(Number(row.amount_original)) : isIncome ? Math.abs(Number(row.amount_original)) : Number(row.amount_original);

      const tags = row.tags && row.tags.length
        ? `<div class="tx-tags">${row.tags.map((tag) => `<span class="pill">${escapeHtml(tag)}</span>`).join("")}</div>`
        : "";

      return `
        <article class="list-row tx-row clickable" data-tx-id="${row.id}">
          <div class="tx-row-main">
            <span class="tx-row-title">${escapeHtml(title)}</span>
            <span class="${amountClass}">${escapeHtml(formatMoney(signedBase))}<span class="tx-unit">${escapeHtml(
              formatCurrencyUnit(baseCurrency)
            )}</span></span>
          </div>
          <div class="tx-row-sub">
            <span class="tx-row-meta">${accountLine ? `${accountLine} · ` : ""}${escapeHtml(row.tx_date)}</span>
            ${
              showOrig
                ? `<span class="tx-orig">${escapeHtml(formatMoney(signedOrig))} ${escapeHtml(
                    formatCurrencyUnit(sourceCurrency)
                  )}</span>`
                : ""
            }
          </div>
          ${row.note ? `<div class="tx-note">${escapeHtml(row.note)}</div>` : ""}
          ${tags}
        </article>`;
    })
    .join("");
}

function renderTodayExpensesCard(rows) {
  const listEl = document.querySelector('#todayExpensesList');
  const totalEl = document.querySelector('#todayExpensesTotal');
  if (!listEl || !totalEl) return;
  const today = new Date().toISOString().slice(0, 10);
  const base = state.settings?.base_currency || 'USD';
  const todayRows = (Array.isArray(rows) ? rows : []).filter(
    (r) => r.tx_date === today && r.type === 'expense'
  );
  const total = todayRows.reduce((s, r) => s + (Number(r.amount_base) || 0), 0);
  totalEl.innerHTML = todayRows.length
    ? `${escapeHtml(formatMoney(total))}<span class="today-total-unit">${escapeHtml(
        formatCurrencyUnit(base)
      )}</span>`
    : '';
  if (!todayRows.length) {
    listEl.innerHTML = `<div class="compact-row muted">${escapeHtml(t("emptyNoExpenseToday"))}</div>`;
    return;
  }
  listEl.innerHTML = todayRows.map((row) => {
    const showOrig = row.currency_original && row.currency_original.toUpperCase() !== base.toUpperCase();
    const signedBase = -Math.abs(Number(row.amount_base));
    const signedOrig = -Math.abs(Number(row.amount_original));
    const icon = getL1EmojiSymbol(row.category_l1);
    const l1 = row.category_l1 || '';
    const l2 = row.category_l2 || '';
    const titleText = l2 ? `${escapeHtml(l1)} / ${escapeHtml(l2)}` : escapeHtml(l1);
    const origLine = showOrig
      ? `<div class="tx-row-sub tx-row-sub-right"><span class="tx-orig">${escapeHtml(
          formatMoney(signedOrig)
        )} ${escapeHtml(formatCurrencyUnit(row.currency_original))}</span></div>`
      : "";
    return `
      <article class="incard-row tx-incard-row clickable" data-tx-id="${row.id}">
        <span class="tx-icon">${icon}</span>
        <div class="tx-incard-body">
          <div class="tx-row-main">
            <span class="tx-row-title">${titleText}</span>
            <span class="tx-amount expense">${escapeHtml(formatMoney(signedBase))}<span class="tx-unit">${escapeHtml(
              formatCurrencyUnit(base)
            )}</span></span>
          </div>
          ${origLine}
          ${row.note ? `<div class="tx-note">${escapeHtml(row.note)}</div>` : ''}
        </div>
      </article>`;
  }).join('');
}

function renderRecentExpensesCard(rows) {
  const target = $("#recentExpensesList");
  if (!target) return;
  renderRecentExpensesSummaryBar(rows, state.recentCompareRows);
  const txRows = (Array.isArray(rows) ? rows : []).slice(0, 5);
  if (!txRows.length) {
    target.innerHTML = `<div class="incard-empty muted">${escapeHtml(t("emptyNoRecentExpense"))}</div>`;
    return;
  }
  const base = state.settings?.base_currency || "USD";
  target.innerHTML = txRows
    .map((row) => {
      const isExpense = row.type === "expense";
      const isIncome = row.type === "income";
      const showOrig = row.currency_original && row.currency_original.toUpperCase() !== base.toUpperCase();
      const signedBase = isExpense ? -Math.abs(Number(row.amount_base)) : isIncome ? Math.abs(Number(row.amount_base)) : Number(row.amount_base);
      const signedOrig = isExpense ? -Math.abs(Number(row.amount_original)) : isIncome ? Math.abs(Number(row.amount_original)) : Number(row.amount_original);
      const amountClass = isExpense ? "tx-amount expense" : isIncome ? "tx-amount income" : "tx-amount transfer";
      const dateLabel = formatRecentExpenseDate(row.tx_date);
      const meta = dateLabel;
      // icon: L1 emoji for expense, type emoji for others
      let icon = "💸";
      let titleText = "";
      if (isExpense) {
        const l1 = row.category_l1 || "";
        const l2 = row.category_l2 || "";
        icon = l2 ? getL2EmojiSymbol(l1, l2) : getL1EmojiSymbol(l1);
        const l2Display = l2
          ? getL2DisplayName(l2, l1, { bilingualDefault: true })
          : "";
        const l1Display = l1
          ? getL1DisplayName(l1, { bilingualDefault: true })
          : "";
        titleText = escapeHtml(l2Display || l1Display || txTypeLabel("expense"));
      } else if (isIncome) {
        icon = "💰";
        titleText = escapeHtml(txTypeLabel("income"));
      } else {
        icon = "🔁";
        const reason = row.transfer_reason && row.transfer_reason !== "normal" ? ` · ${getTransferReasonLabel(row.transfer_reason)}` : "";
        titleText = escapeHtml(txTypeLabel("transfer") + reason);
      }
      return `
      <article class="incard-row tx-incard-row clickable" data-tx-id="${row.id}">
        <span class="tx-icon">${icon}</span>
        <div class="tx-incard-body">
          <div class="tx-row-main">
            <span class="tx-row-title">${titleText}</span>
            <span class="${amountClass}">${escapeHtml(formatMoney(signedBase))}<span class="tx-unit">${escapeHtml(
              formatCurrencyUnit(base)
            )}</span></span>
          </div>
          <div class="tx-row-sub">
            <span class="tx-row-meta">${escapeHtml(meta)}</span>
            ${
              showOrig
                ? `<span class="tx-orig">${escapeHtml(formatMoney(signedOrig))} ${escapeHtml(
                    formatCurrencyUnit(row.currency_original)
                  )}</span>`
                : ""
            }
          </div>
          ${row.note ? `<div class="tx-note">${escapeHtml(row.note)}</div>` : ""}
        </div>
      </article>`;
    })
    .join("");
}

function renderRecentExpensesSummaryBar(rows, recentRows) {
  const target = $("#recentExpensesStats");
  if (!target) return;
  const base = state.settings?.base_currency || "USD";
  const sourceRows =
    Array.isArray(recentRows) && recentRows.length ? recentRows : Array.isArray(rows) ? rows : [];
  const totals = new Map();
  for (const tx of sourceRows) {
    if (!tx || tx.type !== "expense") continue;
    const dateKey = String(tx.tx_date || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) continue;
    const amount = Math.abs(Number(tx.amount_base || 0));
    if (!Number.isFinite(amount) || amount <= 0) continue;
    totals.set(dateKey, (totals.get(dateKey) || 0) + amount);
  }

  const today = new Date();
  const currentDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const items = [
    { key: "recentSpendToday", date: currentDay },
    { key: "recentSpendYesterday", date: addDaysLocal(currentDay, -1) },
    { key: "recentSpendDayBefore", date: addDaysLocal(currentDay, -2) }
  ];

  target.innerHTML = `
    <div class="recent-expense-mini-shell">
      ${items
        .map((item, index) => {
          const dateKey = formatDateOnlyLocal(item.date);
          const amount = Number(totals.get(dateKey) || 0);
          const separator = index < items.length - 1 ? `<span class="recent-expense-mini-sep" aria-hidden="true"></span>` : "";
          return `
            <div class="recent-expense-mini-item">
              <span class="recent-expense-mini-label">${escapeHtml(t(item.key))}</span>
              <div class="recent-expense-mini-money">
                <strong>${escapeHtml(formatCompactKMoney(amount))}</strong>
                <span>${escapeHtml(formatCurrencyUnit(base))}</span>
              </div>
            </div>
            ${separator}
          `;
        })
        .join("")}
    </div>
  `;
}

function formatRecentTransactionTitle(row) {
  if (row?.type === "expense") {
    return formatCategoryPair(row.category_l1, row.category_l2);
  }
  if (row?.type === "income") {
    return `💰 ${txTypeLabel("income")}`;
  }
  if (row?.type === "transfer") {
    const reason =
      row.transfer_reason && row.transfer_reason !== "normal"
        ? ` · ${getTransferReasonLabel(row.transfer_reason)}`
        : "";
    return `🔁 ${txTypeLabel("transfer")}${reason}`;
  }
  return txTypeLabel(row?.type || "-");
}

function formatRecentTransactionContext(row) {
  if (row?.type === "income") {
    return `${t("to")}: ${row.account_to_id || "-"}`;
  }
  if (row?.type === "transfer") {
    return `${t("from")}: ${row.account_from_id || "-"} · ${t("to")}: ${row.account_to_id || "-"}`;
  }
  return "";
}

function formatDateOnlyLocal(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDaysLocal(date, deltaDays) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + Number(deltaDays || 0));
  return next;
}

function getRecentCompareRange() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const mondayOffset = (today.getDay() + 6) % 7;
  const weekStart = addDaysLocal(today, -mondayOffset);
  const weekEnd = addDaysLocal(weekStart, 6);
  // Query full current week + previous week so future-dated demo rows (within this week) can be rendered.
  const endDate = weekEnd;
  const startDate = addDaysLocal(endDate, -13);
  return {
    start: formatDateOnlyLocal(startDate),
    end: formatDateOnlyLocal(endDate)
  };
}

function formatRecentExpenseDate(txDate) {
  const dateText = String(txDate || "");
  const dateObj = parseDateOnlyLocal(dateText);
  if (!dateObj) return dateText;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.floor((today.getTime() - dateObj.getTime()) / 86400000);
  if (diffDays === 0) return t("relativeToday");
  if (diffDays > 0 && diffDays < 3) {
    const relative = diffDays === 1 ? t("relativeDayAgo", { days: diffDays }) : t("relativeDaysAgo", { days: diffDays });
    return relative;
  }
  return dateText;
}

function parseDateOnlyLocal(value) {
  const text = String(value || "");
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  return new Date(year, month - 1, day);
}

function formatTimestampValue(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const normalized = text.replace("T", " ").replace("Z", "").trim();
  const compact = normalized.replace(/\.\d+$/, "");
  if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}/.test(compact)) {
    return compact.slice(0, 16);
  }
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return compact;
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  const hour = String(parsed.getHours()).padStart(2, "0");
  const minute = String(parsed.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

async function loadBudgets() {
  const rows = await api(`/api/v1/budgets?month=${state.month}`);
  $("#budgetForm [name=month]").value = state.month;
  $("#quickBudgetForm [name=month]").value = state.month;
  const target = $("#budgetList");

  // Merge API rows with ALL active L1 categories
  const activeL1 = Object.entries(state.categories || {})
    .filter(([, cfg]) => cfg.active)
    .map(([name]) => name);
  const budgetMap = new Map((rows || []).map((r) => [r.category_l1, r]));
  const merged = activeL1.map((name) => {
    const b = budgetMap.get(name);
    return b ? { ...b, configured: true } : { category_l1: name, month: state.month, total_amount: 0, spent_amount: 0, remaining_amount: 0, configured: false };
  });

  target.innerHTML = merged
    .map((row) => `
      <article class="list-row clickable" data-action="edit-budget" data-scope="monthly" data-period="${escapeHtml(row.month)}" data-category="${escapeHtml(row.category_l1)}" data-amount="${Number(row.total_amount)}">
        <div class="row-main">
          <strong>${escapeHtml(withL1Emoji(row.category_l1))}</strong>
          ${row.configured
            ? `<span class="${row.overspend ? "overspend" : "muted"}">${formatMoney(row.spent_amount)} / ${formatMoney(row.total_amount)}</span>`
            : `<span class="muted">—</span>`}
        </div>
        ${row.configured ? `<div class="muted">${escapeHtml(t("remaining"))}: ${formatMoney(row.remaining_amount)}</div>` : ""}
      </article>`)
    .join("");

  // Dashboard quick list — only configured (amount > 0)
  const quickTarget = $("#quickBudgetList");
  if (quickTarget) {
    const configured = (rows || []).filter((r) => Number(r.total_amount) > 0);
    quickTarget.innerHTML = configured.length
      ? configured.map((row) => `
        <article class="list-row">
          <div class="row-main">
            <strong>${escapeHtml(withL1Emoji(row.category_l1))}</strong>
            <span class="${row.overspend ? "overspend" : "muted"}">${formatMoney(row.spent_amount)} / ${formatMoney(row.total_amount)}</span>
          </div>
          <div class="muted">${escapeHtml(t("remaining"))}: ${formatMoney(row.remaining_amount)}</div>
        </article>`).join("")
      : `<div class="list-row muted">${escapeHtml(t("emptyNoQuickBudget"))}</div>`;
  }
}

async function loadYearlyBudgets() {
  const year = Number(state.month.slice(0, 4));
  const rows = await api(`/api/v1/budgets/yearly?year=${year}`);
  const target = $("#yearlyBudgetList");

  // Merge API rows with ALL active L1 categories
  const activeL1 = Object.entries(state.categories || {})
    .filter(([, cfg]) => cfg.active)
    .map(([name]) => name);
  const budgetMap = new Map((rows || []).map((r) => [r.category_l1, r]));
  const merged = activeL1.map((name) => {
    const b = budgetMap.get(name);
    return b ? { ...b, configured: true } : { category_l1: name, year, total_amount: 0, spent_amount: 0, remaining_amount: 0, configured: false };
  });

  target.innerHTML = merged
    .map((row) => `
      <article class="list-row clickable" data-action="edit-budget" data-scope="yearly" data-period="${escapeHtml(String(row.year))}" data-category="${escapeHtml(row.category_l1)}" data-amount="${Number(row.total_amount)}">
        <div class="row-main">
          <strong>${escapeHtml(withL1Emoji(row.category_l1))}</strong>
          ${row.configured
            ? `<span class="${row.overspend ? "overspend" : "muted"}">${formatMoney(row.spent_amount)} / ${formatMoney(row.total_amount)}</span>`
            : `<span class="muted">—</span>`}
        </div>
        ${row.configured ? `<div class="muted">${escapeHtml(t("remaining"))}: ${formatMoney(row.remaining_amount)}</div>` : ""}
      </article>`)
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
          <strong>${escapeHtml(withL1Emoji(row.category_l1 || ""))} / ${escapeHtml(
        withL2Emoji(row.category_l2 || "", row.category_l1 || "")
      )}</strong>
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
      const l1Encoded = encodeURIComponent(String(name || ""));
      const l1Display = withL1Emoji(name, { bilingualDefault: true, isDefault: Boolean(cfg?.is_default) });
      const l2 = (cfg.l2 || [])
        .filter((item) => item && item.active)
        .map((item) => {
          const l2Encoded = encodeURIComponent(String(item.name || ""));
          const l2Display = withL2Emoji(item.name, name, {
            bilingualDefault: true,
            isDefault: Boolean(item?.is_default)
          });
          const deleteLabel = t("deleteTagAction", { l2: l2Display });
          return `
            <span class="category-tag-item">
              <span class="pill">${escapeHtml(l2Display)}</span>
              <button
                class="category-tag-delete-btn"
                type="button"
                data-action="delete-l2"
                data-l1="${escapeHtml(l1Encoded)}"
                data-l2="${escapeHtml(l2Encoded)}"
                aria-label="${escapeHtml(deleteLabel)}"
                title="${escapeHtml(deleteLabel)}"
              >×</button>
            </span>`;
        })
        .join("");
      return `
        <article class="list-row">
          <div class="row-main">
            <button
              class="category-l1-edit-btn"
              type="button"
              data-action="edit-l1"
              data-l1="${escapeHtml(l1Encoded)}"
              aria-label="${escapeHtml(t("editCategoryL1Action", { l1: l1Display }))}"
              title="${escapeHtml(t("editCategoryL1Action", { l1: l1Display }))}"
            >${escapeHtml(l1Display)}</button>
            <div class="category-row-actions">
              <button
                class="category-inline-add-header"
                type="button"
                data-action="add-l2"
                data-l1="${escapeHtml(name)}"
                title="${escapeHtml(t("promptL2Name", { l1: l1Display }))}"
                aria-label="${escapeHtml(t("promptL2Name", { l1: l1Display }))}"
              >${escapeHtml(t("addL2Action"))}</button>
            </div>
          </div>
          <div class="tag-wrap">${l2 || `<span class="muted">${escapeHtml(t("emptyNoL2Categories"))}</span>`}</div>
        </article>`;
    })
    .join("");
}

async function refreshAfterLedgerChange() {
  await Promise.all([
    loadAccounts(),
    loadDashboard(),
    loadTransactions(),
    loadRecentCompareData(),
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

function ensureCurrencyDisplayMode(value) {
  const mode = String(value || "code").toLowerCase();
  return UI_CURRENCY_DISPLAY_MODES.has(mode) ? mode : "code";
}

function ensureUITheme(value) {
  const mode = String(value || "system").toLowerCase();
  return UI_THEMES.has(mode) ? mode : "system";
}

function ensureOnboardingIncomeBand(value) {
  const band = String(value || "8000_20000").trim();
  return ONBOARDING_INCOME_BANDS.has(band) ? band : "8000_20000";
}

function ensureOnboardingCountryCode(value) {
  const code = String(value || "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : DEFAULT_ONBOARDING_COUNTRY_CODE;
}

function normalizeOnboardingStep(value) {
  const step = String(value || "step1").trim();
  return ONBOARDING_STEPS.has(step) ? step : "step1";
}

function resolveThemeMode(themeValue) {
  const mode = ensureUITheme(themeValue);
  if (mode === "aurora") return "aurora";
  if (mode === "dark" || mode === "light") return mode;
  return systemThemeMedia?.matches ? "dark" : "light";
}

function applyTheme(themeValue = state.settings?.theme || "system") {
  const selected = ensureUITheme(themeValue);
  const resolved = resolveThemeMode(selected);
  document.documentElement.setAttribute("data-theme", resolved);
  document.documentElement.setAttribute("data-theme-preference", selected);
}

if (systemThemeMedia) {
  const handleSystemThemeChange = () => {
    if (ensureUITheme(state.settings?.theme || "system") !== "system") return;
    applyTheme("system");
  };
  if (typeof systemThemeMedia.addEventListener === "function") {
    systemThemeMedia.addEventListener("change", handleSystemThemeChange);
  } else if (typeof systemThemeMedia.addListener === "function") {
    systemThemeMedia.addListener(handleSystemThemeChange);
  }
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

function setAttr(id, name, value) {
  const el = document.getElementById(id);
  if (el) el.setAttribute(name, value);
}

function applyI18n() {
  setText("authTitle", t("authTitle"));
  setText("authSubtitle", t("authSubtitle"));
  setText("authEmailLabel", t("authEmailLabel"));
  setText("authContinueBtn", t("authContinueBtn"));
  setText("authCodeLabel", t("authCodeLabel"));
  setText("authResendBtn", t("authResendBtn"));
  setText("authHint", t("authHint"));
  setText("onboardingTitle", t("onboardingTitle"));
  setText("onboardingSubtitle", t("onboardingSubtitle"));
  setText("onboardingStep1Title", t("onboardingStep1Title"));
  setText("onboardingStep2Title", t("onboardingStep2Title"));
  setText("onboardingStep3Title", t("onboardingStep3Title"));
  setText("onboardingCountryLabel", t("onboardingCountry"));
  setText("onboardingTimezoneLabel", t("onboardingTimezone"));
  setText("onboardingBaseCurrencyLabel", t("baseCurrency"));
  setText("onboardingIncomeBandLabel", t("onboardingIncomeBand"));
  setText("onboardingGeoHint", t("onboardingGeoHint"));
  setText("onboardingStep1ContinueBtn", t("onboardingContinue"));
  setText("onboardingStep2Intro", t("onboardingStep2Intro"));
  setText("onboardingCategoryHint", t("onboardingCategoryHint"));
  setText("onboardingAccountsTitle", t("onboardingAccountsTitle"));
  setText("onboardingCategoriesTitle", t("onboardingCategoriesTitle"));
  setText("onboardingBudgetTitle", t("onboardingBudgetTitle"));
  setText("onboardingBudgetHint", t("onboardingBudgetHint"));
  setText("onboardingAddAccountBtn", t("onboardingAdd"));
  setText("onboardingAddL1Btn", t("onboardingAddL1"));
  setText("onboardingAddL2Btn", t("onboardingAddL2"));
  setText("onboardingStep2ContinueBtn", t("onboardingContinue"));
  setText("onboardingStep3Intro", t("onboardingStep3Intro"));
  setText("onboardingHasAgentYesLabel", t("onboardingHasAgentYes"));
  setText("onboardingHasAgentNoLabel", t("onboardingHasAgentNo"));
  setText("onboardingCountryOptionCN", t("onboardingCountryOptionCN"));
  setText("onboardingCountryOptionUS", t("onboardingCountryOptionUS"));
  setText("onboardingCountryOptionHK", t("onboardingCountryOptionHK"));
  setText("onboardingCountryOptionMO", t("onboardingCountryOptionMO"));
  setText("onboardingCountryOptionTW", t("onboardingCountryOptionTW"));
  setText("onboardingCountryOptionSG", t("onboardingCountryOptionSG"));
  setText("onboardingCountryOptionJP", t("onboardingCountryOptionJP"));
  setText("onboardingCountryOptionKR", t("onboardingCountryOptionKR"));
  setText("onboardingCountryOptionTH", t("onboardingCountryOptionTH"));
  setText("onboardingCountryOptionMY", t("onboardingCountryOptionMY"));
  setText("onboardingCountryOptionGB", t("onboardingCountryOptionGB"));
  setText("onboardingCountryOptionDE", t("onboardingCountryOptionDE"));
  setText("onboardingCountryOptionFR", t("onboardingCountryOptionFR"));
  setText("onboardingCountryOptionCA", t("onboardingCountryOptionCA"));
  setText("onboardingCountryOptionAU", t("onboardingCountryOptionAU"));
  setText("onboardingCountryOptionCH", t("onboardingCountryOptionCH"));
  setText("onboardingCountryOptionIN", t("onboardingCountryOptionIN"));
  setText("onboardingCountryOptionAE", t("onboardingCountryOptionAE"));
  const onboardingTimezoneInput = $("#onboardingTimezoneInput");
  if (onboardingTimezoneInput) onboardingTimezoneInput.placeholder = t("onboardingTimezonePlaceholder");
  const onboardingAccountNameInput = $("#onboardingAccountNameInput");
  if (onboardingAccountNameInput) onboardingAccountNameInput.placeholder = t("onboardingAccountNamePlaceholder");
  const onboardingNewL1Input = $("#onboardingNewL1Input");
  if (onboardingNewL1Input) onboardingNewL1Input.placeholder = t("onboardingNewL1Placeholder");
  const onboardingNewL2Input = $("#onboardingNewL2Input");
  if (onboardingNewL2Input) onboardingNewL2Input.placeholder = t("onboardingNewL2Placeholder");
  setText("onboardingIncomeBandLt3000", t("onboardingIncomeBandLt3000"));
  setText("onboardingIncomeBand3000_8000", t("onboardingIncomeBand3000_8000"));
  setText("onboardingIncomeBand8000_20000", t("onboardingIncomeBand8000_20000"));
  setText("onboardingIncomeBand20000_50000", t("onboardingIncomeBand20000_50000"));
  setText("onboardingIncomeBand50000Plus", t("onboardingIncomeBand50000Plus"));
  localizeAccountTypeSelectOptions();
  syncTopCurrencyModeControl();
  setText("subtitleText", t("subtitle"));
  setText("monthLabelText", t("month"));
  setText("tabDashboardBtn", `🏠 ${t("tabDashboard")}`);
  setText("tabTransactionsBtn", `🧾 ${t("tabTransactions")}`);
  setText("transactionTypeFilterAllOption", t("txFilterAllTypes"));
  setText("transactionTypeFilterExpenseOption", t("txTypeExpense"));
  setText("transactionTypeFilterIncomeOption", t("txTypeIncome"));
  setText("transactionTypeFilterTransferOption", t("txTypeTransfer"));
  setText("transactionCategoryFilterAllOption", t("txFilterAllCategories"));
  setText("applyTxFilterBtn", t("txFilterApply"));
  setText("resetTxFilterBtn", t("txFilterReset"));
  const transactionTagFilterInput = $("#transactionTagFilter");
  if (transactionTagFilterInput) transactionTagFilterInput.placeholder = t("txFilterTagPlaceholder");
  setAttr("transactionStartFilter", "aria-label", t("txFilterStartDate"));
  setAttr("transactionEndFilter", "aria-label", t("txFilterEndDate"));
  setText("tabBudgetsBtn", `📋 ${t("tabBudgets")}`);
  setText("tabAccountsBtn", `🏦 ${t("tabAccounts")}`);
  setText("tabReviewBtn", `🗓️ ${t("tabReview")}`);
  setText("tabCategoriesBtn", `🧩 ${t("tabCategories")}`);
  setText("tabSettingsBtn", `⚙️ ${t("tabSettings")}`);
  setText("dashboardTitle", t("dashboard"));
  setText("dashboardPinnedLabel", t("pinned"));
  setText("dashWidgetsEditBtn", t("edit"));
  setText("todayCardTitle", `☀️ ${t("relativeToday")}`);
  setText("recentCompareTitle", t("recentCompareTitle"));
  setText("heroNetWorthLabel", t("metricNetWorth"));
  renderHeroPrivacyToggleControl();
  setText("heroCompositionLabel", t("netWorthComposition"));
  syncHeroCompositionToggleControl();
  setText("heroLiquidLegend", t("labelLiquid"));
  setText("heroRestrictedLegend", t("labelRestricted"));
  setText("budgetPlanTitle", t("plannedBudget"));
  setText("dashboardAccountsTitle", t("accounts"));
  setText("recentExpensesTitle", t("recentExpenses"));
  setAttr("recentExpensesTitle", "title", t("recentExpenses"));
  setAttr("recentExpensesTitle", "aria-label", t("recentExpenses"));
  setAttr("quickDateToggleBtn", "title", t("quickDateToggle"));
  setAttr("quickDateToggleBtn", "aria-label", t("quickDateToggle"));
  const bvList = document.getElementById("budgetViewList");
  const bvPie = document.getElementById("budgetViewPie");
  if (bvList) bvList.innerHTML = "≡";
  if (bvPie) bvPie.innerHTML = "◔";
  setAttr("quickEntryBackBtn", "title", t("back"));
  setAttr("quickEntryBackBtn", "aria-label", t("back"));
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
  setText("quickEntryDateInputLabel", t("date"));
  setText("quickStepL1Title", t("stepL1Title"));
  setText("quickStepL2Title", t("stepL2Title"));
  setText("quickStepTransferReasonTitle", t("stepTransferTitle"));
  setText("quickStepSpendTitle", t("stepSpendTitle"));
  setText("quickStepAmountTitle", t("stepAmountTitle"));
  setText("quickEntryL1Label", t("categoryL1"));
  setText("quickEntryL2Label", t("categoryL2"));
  setText("quickEntryAccountLabel", t("account"));
  setText("quickEntryAccountToLabel", t("accountTo"));
  setText("quickEntryTransferReasonLabel", t("transferMode"));
  setText("quickEntryCurrencyLabel", t("currency"));
  setText("quickDateDefaultHint", t("quickDateHint"));
  updateQuickDateDisplay();
  setText("quickEntryAmountLabel", t("amount"));
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
  setText("budgetsPanelTitle", t("budgetPanelTitle"));
  setText("reviewPanelTitle", t("navReview"));
  setText("generateReviewBtn", t("refresh"));
  setText("reviewSummaryTitle", t("reviewSummaryHeading"));
  setText("reviewL1Title", t("reviewExpenseBreakdown"));
  setText("reviewTopTitle", t("reviewTopExpenses"));
  setText("settingsSheetTitle", t("settings"));
  setText("settingsGeneralNavLabel", t("general"));
  setText("settingsGeneralPageTitle", t("general"));
  setText("quickSettingsUserLabel", t("userId"));
  setText("quickSettingsLangLabel", t("language"));
  setText("quickSettingsBaseLabel", t("baseCurrency"));
  setText("quickSettingsCurrencyDisplayLabel", t("currencyDisplay"));
  setText("quickSettingsCurrencyDisplayCodeOption", t("currencyDisplayCode"));
  setText("quickSettingsCurrencyDisplaySymbolOption", t("currencyDisplaySymbol"));
  setText("quickSettingsThemeLabel", t("theme"));
  setText("quickSettingsThemeSystemOption", t("themeSystem"));
  setText("quickSettingsThemeLightOption", t("themeLight"));
  setText("quickSettingsThemeDarkOption", t("themeDark"));
  setText("quickSettingsThemeAuroraOption", t("themeAurora"));
  setText("quickSettingsTimezoneLabel", t("timezone"));
  setText("quickSettingsAdvancedLabel", t("advancedInsights"));
  setText("settingsAdvancedPageTitle", t("dashboardWidgets"));
  setText("settingsAdvancedSectionLabel", t("showOnDashboard"));
  setText("toggleCashFlowLabel", t("showCashFlow"));
  setText("toggleTrendLabel", t("showTrend"));
  setText("toggleRiskLabel", t("showRisk"));
  setText("toggleDebugLabel", t("showDebug"));
  setText("toggleRecentExpensesLabel", t("showRecentExpenses"));
  setText("toggleTodayLabel", t("showToday"));
  setText("toggleRecentCompareLabel", t("showRecentCompare"));
  setText("toggleAccountsLabel", t("showAccounts"));
  setText("debugPanelTitle", t("debugPanel"));
  setText("debugOnlyFailedLabel", t("debugOnlyFailed"));
  setText("debugFilterLabel", t("debugFilter"));
  setText("debugCopyBtn", t("debugCopy"));
  setText("debugClearBtn", t("debugClear"));
  setText("debugRequestsTitle", t("debugRequests"));
  setText("debugRuntimeTitle", t("debugRuntime"));
  setText("quickSettingsSaveBtn", t("saveSettings"));
  setText("quickLogoutBtn", t("logout"));
  setText("settingsLinkBudgetLabel", t("navBudget"));
  setText("settingsLinkAccountsLabel", t("navAccounts"));
  setText("settingsLinkReviewLabel", t("navReview"));
  setText("settingsLinkCategoriesLabel", t("navCategories"));
  setText("addL1BottomBtn", t("addL1Bottom"));
  setText("budgetAddCategoryLabel", t("addCategory"));
  setText("categoryPromptParentLabel", t("categoryPromptParentLabel"));
  setText("categoryPromptEmojiLabel", t("categoryPromptEmojiLabel"));
  setText("settingsLinkAiLabel", t("navAgentAccess"));
  setText("agentTokenListTitle", t("agentTokensTitle"));
  setText("agentAccessFlowHint", t("agentAccessFlowHint"));
  setText("agentTokenCreateSheetTitle", t("agentTokenCreateSheetTitle"));
  setText("agentTokenCreateSheetHint", t("agentTokenCreateSheetHint"));
  setText("agentTokenNameLabel", t("agentTokenName"));
  setText("agentTokenCreateBtn", t("createAgentToken"));
  setText("agentTokenRevealTitle", t("agentTokenRevealTitle"));
  setText("agentTokenRevealOptionToken", t("agentTokenRevealOptionToken"));
  setText("agentTokenRevealOptionSetup", t("agentTokenRevealOptionSetup"));
  setText("agentTokenRevealCopyBtn", t("copyTokenOnly"));
  setText("agentTokenRevealCopySetupBtn", t("copyAgentSetupWithToken"));
  setText("accountEditTitle", t("editAccount"));
  setText("accountEditNameLabel", t("account"));
  setText("accountEditTypeLabel", t("accountType"));
  setText("accountEditBalanceLabel", t("amount"));
  setText("accountEditSaveBtn", t("saveAccount"));
  setText("accountDeleteBtn", t("deleteAccount"));
  setText("accountForceDeleteBtn", t("forceDeleteAccount"));
  setText("budgetEditTitle", t("editBudget"));
  setText("budgetEditScopeLabel", t("budgetScope"));
  setText("budgetEditPeriodLabel", t("budgetPeriod"));
  setText("budgetEditCatLabel", t("categoryL1"));
  setText("budgetEditAmtLabel", t("amount"));
  setText("budgetEditHint", t("budgetEditHint"));
  setText("budgetEditSaveBtn", t("saveBudget"));
  setText("transactionEditTitle", t("editTransaction"));
  setText("transactionEditTypeLabel", t("type"));
  setText("transactionEditDateLabel", t("date"));
  setText("transactionEditAmountLabel", t("amount"));
  setText("transactionEditCurrencyLabel", t("currency"));
  setText("transactionEditFxLabel", t("fxRateOptional"));
  setText("transactionEditL1Label", t("categoryL1"));
  setText("transactionEditL2Label", t("categoryL2"));
  setText("transactionEditFromLabel", t("account"));
  setText("transactionEditToLabel", t("accountTo"));
  setText("transactionEditReasonLabel", t("transferMode"));
  setText("transactionEditTagsLabel", t("tagsLabel"));
  setText("transactionEditNoteLabel", t("note"));
  setText("transactionEditSaveBtn", t("saveTransaction"));
  setText("transactionDeleteBtn", t("deleteTransaction"));
  setText("transactionDetailTitle", t("transactionDetailTitle"));
  setText("transactionDetailEditBtn", t("edit"));
  setText("transactionDetailDeleteBtn", t("deleteTransaction"));
  setText("transactionDetailAmountLabel", t("transactionDetailAmount"));
  setText("transactionDetailCategoryLabel", t("transactionDetailCategory"));
  setText("transactionDetailAccountLabel", t("transactionDetailAccount"));
  setText("transactionDetailTimeLabel", t("transactionDetailTime"));
  setText("closeUtilityBtn", "←");
  const utilityBtn = $("#closeUtilityBtn");
  if (utilityBtn) utilityBtn.setAttribute("aria-label", t("back"));
  // Panel back buttons — keep icon-only for visual consistency and use localized a11y label.
  for (const btn of document.querySelectorAll(".panel-back-btn")) {
    btn.textContent = "←";
    btn.setAttribute("aria-label", t("navBackSettings"));
    btn.setAttribute("title", t("navBackSettings"));
  }
  const quickNote = document.querySelector("#quickEntryForm [name=note]");
  if (quickNote) {
    quickNote.placeholder = t("note");
  }
  if ((state.accounts || []).length) {
    populateQuickEntryAccounts();
  }
  renderQuickTransferReasonGrid();
  applyTransferReasonOptionLabels($("#quickEntryForm [name=transfer_reason]"));
  applyTransferReasonOptionLabels($("#transactionForm [name=transfer_reason]"));
  applyTransferReasonOptionLabels($("#transactionEditForm [name=transfer_reason]"));
  updateCategoryPromptView();
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
    if (!(button instanceof HTMLButtonElement)) continue;
    if (button.id === "quickEntryBackBtn") {
      button.textContent = "←";
      button.setAttribute("aria-label", t("back"));
      button.setAttribute("title", t("back"));
      continue;
    }
    button.textContent = t("close");
  }
  const debugFilterInput = $("#debugFilterInput");
  if (debugFilterInput) {
    debugFilterInput.placeholder = t("debugFilterPlaceholder");
  }
  populateTransactionFilterCategorySelect();
  applyTransactionFiltersToInputs();
  if (state.onboarding.stateLoaded) {
    renderOnboardingGate();
  }
  renderRecentExpensesCard(state.transactions || []);
  renderTodayExpensesCard(state.transactions || []);
  renderRecentCompareCard(state.recentCompareRows || []);
  renderAgentTokens();
  renderDebugPanel();
}

function applyAdvancedVisibility() {
  const cashFlow = $("#cashFlowCard");
  const trendCard = $("#trendCard");
  const riskCard = $("#riskCard");
  const recentExpensesCard = $("#recentExpensesCard");
  const recentCompareCard = $("#recentCompareCard");
  const debugPanel = $("#debugPanel");
  if (cashFlow) cashFlow.classList.toggle("hidden", !state.ui.showCashFlow);
  if (trendCard) trendCard.classList.toggle("hidden", !state.ui.showTrend);
  if (riskCard) riskCard.classList.toggle("hidden", !state.ui.showRisk);
  if (recentExpensesCard) recentExpensesCard.classList.toggle("hidden", !state.ui.showRecentExpenses);
  if (recentCompareCard) recentCompareCard.classList.toggle("hidden", !state.ui.showRecentCompare);
  const todayCard = $("#todayExpensesCard");
  if (todayCard) todayCard.classList.toggle("hidden", !state.ui.showToday);
  const accountsCard = $("#dashboardAccountsCard");
  if (accountsCard) accountsCard.classList.toggle("hidden", !state.ui.showAccounts);
  if (debugPanel) debugPanel.classList.toggle("hidden", !state.ui.showDebug);
}

function loadUiState() {
  try {
    const raw = localStorage.getItem("nfos_ui_state");
    if (!raw) return;
    const parsed = JSON.parse(raw);
    const isLegacyUiState = Number(parsed.uiVersion || 0) < UI_STATE_VERSION;
    state.ui.showCashFlow = Boolean(parsed.showCashFlow);
    state.ui.showTrend = Boolean(parsed.showTrend);
    state.ui.showRisk = Boolean(parsed.showRisk);
    state.ui.showRecentExpenses = parsed.showRecentExpenses !== false;
    state.ui.showToday = parsed.showToday !== false;
    state.ui.showRecentCompare = parsed.showRecentCompare === true;
    state.ui.showAccounts = parsed.showAccounts !== false;
    if (isLegacyUiState) {
      state.ui.showRecentCompare = false;
      if (parsed.showAccounts === false && parsed.showRecentCompare !== false) {
        state.ui.showAccounts = true;
      }
    }
    state.ui.showDebug = Boolean(parsed.showDebug);
    state.ui.budgetPieView = Boolean(parsed.budgetPieView);
    state.ui.accountCompositionPercent = Boolean(parsed.accountCompositionPercent);
    state.ui.hideSensitiveAmounts = Boolean(parsed.hideSensitiveAmounts);
    if (parsed.debug) {
      state.debug.onlyFailed = Boolean(parsed.debug.onlyFailed);
      state.debug.filter = String(parsed.debug.filter || "");
    }
    if (parsed.trend) {
      state.trend.start = parsed.trend.start || state.trend.start;
      state.trend.end = parsed.trend.end || state.trend.end;
      state.trend.mode = parsed.trend.mode || state.trend.mode;
    }
    if (parsed.categoryEmoji) {
      state.categoryEmoji = {
        l1: parsed.categoryEmoji.l1 && typeof parsed.categoryEmoji.l1 === "object" ? parsed.categoryEmoji.l1 : {},
        l2: parsed.categoryEmoji.l2 && typeof parsed.categoryEmoji.l2 === "object" ? parsed.categoryEmoji.l2 : {}
      };
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
        uiVersion: UI_STATE_VERSION,
        showCashFlow: state.ui.showCashFlow,
        showTrend: state.ui.showTrend,
        showRisk: state.ui.showRisk,
        showRecentExpenses: state.ui.showRecentExpenses,
        showToday: state.ui.showToday,
        showRecentCompare: state.ui.showRecentCompare,
        showAccounts: state.ui.showAccounts,
        showDebug: state.ui.showDebug,
        budgetPieView: state.ui.budgetPieView,
        accountCompositionPercent: state.ui.accountCompositionPercent,
        hideSensitiveAmounts: state.ui.hideSensitiveAmounts,
        trend: {
          start: state.trend.start,
          end: state.trend.end,
          mode: state.trend.mode
        },
        debug: {
          onlyFailed: state.debug.onlyFailed,
          filter: state.debug.filter
        },
        categoryEmoji: state.categoryEmoji
      })
    );
  } catch {
    // ignore localStorage errors
  }
}

function buildL2EmojiKey(l1Name, l2Name) {
  return `${String(l1Name || "").trim()}|||${String(l2Name || "").trim()}`;
}

function normalizeEmojiInput(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const compact = raw.split(/\s+/)[0] || "";
  return compact.slice(0, 8);
}

function formatDefaultCategoryDisplayLabel(name, scope = "l1") {
  const label = String(name || "").trim();
  if (!label || label === "-") return label;
  const dict = scope === "l2" ? DEFAULT_CATEGORY_L2_LABELS : DEFAULT_CATEGORY_L1_LABELS;
  const direct = dict[label];
  if (direct) {
    const lang = ensureUILanguage(state.settings?.ui_language || "en");
    return lang === "zh" ? direct.zh : direct.en;
  }
  for (const entry of Object.values(dict)) {
    if (entry.en === label || entry.zh === label) {
      const lang = ensureUILanguage(state.settings?.ui_language || "en");
      return lang === "zh" ? entry.zh : entry.en;
    }
  }
  return label;
}

function getL1DisplayName(name, options = {}) {
  const label = String(name || "").trim();
  if (!label || label === "-") return label;
  if (!options.bilingualDefault && !options.localizeDefault) return label;
  const isDefault =
    typeof options.isDefault === "boolean" ? options.isDefault : Boolean(state.categories?.[label]?.is_default);
  if (!isDefault) return label;
  return formatDefaultCategoryDisplayLabel(label, "l1");
}

function getL2DisplayName(name, l1Name = "", options = {}) {
  const label = String(name || "").trim();
  if (!label || label === "-") return label;
  if (!options.bilingualDefault && !options.localizeDefault) return label;
  let isDefault = typeof options.isDefault === "boolean" ? options.isDefault : false;
  if (typeof options.isDefault !== "boolean") {
    const l1 = String(l1Name || "").trim();
    const row = (state.categories?.[l1]?.l2 || []).find((item) => String(item?.name || "") === label);
    isDefault = Boolean(row?.is_default);
  }
  if (!isDefault) return label;
  return formatDefaultCategoryDisplayLabel(label, "l2");
}

function getL1EmojiSymbol(name) {
  const label = String(name || "").trim();
  if (!label) return "🏷️";
  return state.categoryEmoji?.l1?.[label] || CATEGORY_L1_EMOJI[label] || "🏷️";
}

function getL2EmojiSymbol(l1Name, l2Name) {
  const l1 = String(l1Name || "").trim();
  const l2 = String(l2Name || "").trim();
  if (!l2) return "🔹";
  return state.categoryEmoji?.l2?.[buildL2EmojiKey(l1, l2)] || CATEGORY_L2_EMOJI[l2] || "🔹";
}

function pruneCategoryEmojiMap() {
  const existingL1 = new Set(Object.keys(state.categories || {}));
  const nextL1 = {};
  for (const [name, emoji] of Object.entries(state.categoryEmoji?.l1 || {})) {
    if (existingL1.has(name) && emoji) nextL1[name] = emoji;
  }
  const nextL2 = {};
  for (const [key, emoji] of Object.entries(state.categoryEmoji?.l2 || {})) {
    if (!emoji) continue;
    const [l1Name, l2Name] = String(key).split("|||");
    const l2Rows = state.categories?.[l1Name]?.l2 || [];
    if (l2Rows.some((row) => row?.name === l2Name)) {
      nextL2[buildL2EmojiKey(l1Name, l2Name)] = emoji;
    }
  }
  state.categoryEmoji = { l1: nextL1, l2: nextL2 };
}

function withL1Emoji(name, options = {}) {
  const label = String(name || "").trim();
  if (!label || label === "-") return "-";
  const localizeDefault =
    typeof options.localizeDefault === "boolean" ? options.localizeDefault : true;
  return `${getL1EmojiSymbol(label)} ${getL1DisplayName(label, { ...options, localizeDefault })}`;
}

function withL2Emoji(name, l1Name = "", options = {}) {
  const label = String(name || "").trim();
  if (!label || label === "-") return "-";
  const localizeDefault =
    typeof options.localizeDefault === "boolean" ? options.localizeDefault : true;
  return `${getL2EmojiSymbol(l1Name, label)} ${getL2DisplayName(label, l1Name, { ...options, localizeDefault })}`;
}

function formatCategoryPair(l1, l2) {
  const left = l1 ? withL1Emoji(l1) : "-";
  const right = l2 ? withL2Emoji(l2, l1) : "-";
  return `${left} / ${right}`;
}

function accountTypeEmoji(type) {
  const key = String(type || "").trim();
  return ACCOUNT_TYPE_META[key]?.emoji || "💼";
}

function accountTypeLabel(type) {
  const key = String(type || "").trim();
  const i18nKey = ACCOUNT_TYPE_META[key]?.i18nKey;
  if (!i18nKey) return key || "-";
  return t(i18nKey);
}

function accountTypeDisplay(type) {
  return `${accountTypeEmoji(type)} ${accountTypeLabel(type)}`;
}

function localizeAccountTypeSelectOptions() {
  const selectors = [
    "#onboardingAccountTypeInput",
    "#accountForm [name=type]",
    "#accountEditForm [name=type]"
  ];
  for (const selector of selectors) {
    const select = $(selector);
    if (!(select instanceof HTMLSelectElement)) continue;
    for (const option of Array.from(select.options)) {
      option.textContent = accountTypeDisplay(option.value);
    }
  }
}

function txTypeLabel(type) {
  if (type === "expense") return t("txTypeExpense");
  if (type === "income") return t("txTypeIncome");
  if (type === "transfer") return t("txTypeTransfer");
  return String(type || "").toUpperCase();
}

// ── Dashboard drag-to-reorder ──────────────────────────────────────────────

const DASH_ORDER_KEY = "nomad-dash-order";
const DEFAULT_DASH_ORDER = [
  "dashboardAccountsCard",
  "budgetPlanCard",
  "recentExpensesCard",
  "todayExpensesCard",
  "recentCompareCard",
  "cashFlowCard",
  "trendCard",
  "riskCard"
];

function applyDashboardOrder() {
  const container = document.getElementById("dashboardSortable");
  if (!container) return;
  let order;
  try { order = JSON.parse(localStorage.getItem(DASH_ORDER_KEY) || "null"); } catch { order = null; }
  const hasCustomOrder = Array.isArray(order) && order.length > 0;
  const targetOrder = hasCustomOrder ? order : DEFAULT_DASH_ORDER;
  if (!Array.isArray(targetOrder) || !targetOrder.length) return;
  const cards = [...container.querySelectorAll("[data-sort-id]")];
  const map = {};
  for (const el of cards) map[el.dataset.sortId] = el;
  const placed = new Set();
  for (const id of targetOrder) {
    if (map[id]) {
      container.appendChild(map[id]);
      placed.add(id);
    }
  }
  for (const el of cards) {
    const id = String(el.dataset.sortId || "");
    if (id && !placed.has(id)) {
      container.appendChild(el);
    }
  }
}

function saveDashboardOrder() {
  const container = document.getElementById("dashboardSortable");
  if (!container) return;
  const ids = [...container.querySelectorAll("[data-sort-id]")].map(el => el.dataset.sortId);
  try { localStorage.setItem(DASH_ORDER_KEY, JSON.stringify(ids)); } catch {}
}

function initDashboardDrag() {
  const container = document.getElementById("dashboardSortable");
  if (!container) return;
  applyDashboardOrder();

  let dragEl = null;
  let placeholder = null;
  let longPressTimer = null;
  let pressTimer = null;
  let pressEl = null;
  let dragOffsetY = 0;
  let active = false;
  let currentTouchY = 0;

  function snapshots() {
    return [...container.children]
      .filter(c => c !== dragEl && !c.classList.contains("drag-placeholder"))
      .map(c => ({ el: c, midY: c.getBoundingClientRect().top + c.getBoundingClientRect().height / 2 }));
  }

  function movePlaceholder(clientY) {
    const snaps = snapshots();
    let insertBefore = null;
    for (const s of snaps) {
      if (clientY < s.midY) { insertBefore = s.el; break; }
    }
    if (insertBefore) container.insertBefore(placeholder, insertBefore);
    else container.appendChild(placeholder);
    const contRect = container.getBoundingClientRect();
    dragEl.style.transform = `translateY(${clientY - contRect.top - dragOffsetY}px)`;
  }

  function startDrag(card, clientY) {
    active = true;
    dragEl = card;
    document.body.style.webkitUserSelect = "none";
    document.body.style.userSelect = "none";
    const rect = card.getBoundingClientRect();
    dragOffsetY = clientY - rect.top;
    placeholder = document.createElement("div");
    placeholder.className = "drag-placeholder";
    placeholder.style.height = rect.height + "px";
    container.insertBefore(placeholder, card);
    card.style.position = "absolute";
    card.style.top = "0";
    card.style.left = "0";
    card.style.width = rect.width + "px";
    card.style.zIndex = "200";
    card.style.pointerEvents = "none";
    card.classList.add("is-dragging");
    container.style.position = "relative";
    container.classList.add("sort-active");
    if (navigator.vibrate) navigator.vibrate(38);
    movePlaceholder(clientY);
  }

  function unlockSelection() {
    document.body.style.webkitUserSelect = "";
    document.body.style.userSelect = "";
  }

  function clearPressState() {
    if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
    if (pressEl) { pressEl.classList.remove("press-ready"); pressEl = null; }
  }

  function endDrag() {
    if (!active) return;
    active = false;
    unlockSelection();
    container.insertBefore(dragEl, placeholder);
    placeholder.remove();
    placeholder = null;
    dragEl.style.cssText = "";
    dragEl.classList.remove("is-dragging");
    container.style.position = "";
    container.classList.remove("sort-active");
    dragEl = null;
    saveDashboardOrder();
  }

  function cancelDrag() {
    if (!active) return;
    active = false;
    unlockSelection();
    placeholder && placeholder.remove();
    placeholder = null;
    if (dragEl) {
      dragEl.style.cssText = "";
      dragEl.classList.remove("is-dragging");
    }
    dragEl = null;
    container.style.position = "";
    container.classList.remove("sort-active");
  }

  // ── Touch ──
  container.addEventListener("touchstart", (e) => {
    const card = e.target.closest("[data-sort-id]");
    if (!card) return;
    document.body.style.webkitUserSelect = "none";
    document.body.style.userSelect = "none";
    pressEl = card;
    currentTouchY = e.touches[0].clientY;
    pressTimer = setTimeout(() => card.classList.add("press-ready"), 80);
    longPressTimer = setTimeout(() => {
      clearPressState();
      startDrag(card, currentTouchY);
    }, 500);
  }, { passive: false });

  window.addEventListener("touchmove", (e) => {
    currentTouchY = e.touches[0].clientY;
    if (longPressTimer) {
      clearTimeout(longPressTimer); longPressTimer = null;
      clearPressState();
      unlockSelection();
    }
    if (!active) return;
    e.preventDefault();
    movePlaceholder(e.touches[0].clientY);
  }, { passive: false });

  window.addEventListener("touchend", () => {
    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
    clearPressState();
    if (active) endDrag(); else unlockSelection();
  });

  window.addEventListener("touchcancel", () => {
    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
    clearPressState();
    unlockSelection();
    cancelDrag();
  });

  // ── Mouse (desktop) ──
  container.addEventListener("mousedown", (e) => {
    const card = e.target.closest("[data-sort-id]");
    if (!card || e.target.closest("button,input,select,a,textarea")) return;
    const clientY = e.clientY;
    longPressTimer = setTimeout(() => {
      e.preventDefault();
      startDrag(card, clientY);
    }, 500);
  });

  window.addEventListener("mousemove", (e) => {
    if (longPressTimer && Math.abs(e.movementY) > 4) {
      clearTimeout(longPressTimer); longPressTimer = null;
    }
    if (!active) return;
    movePlaceholder(e.clientY);
  });

  window.addEventListener("mouseup", () => {
    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
    if (active) endDrag();
  });
}

document.addEventListener("DOMContentLoaded", initDashboardDrag);

// ── Settings page navigation ──────────────────────────────────────
function showSettingsPage(pageId, direction = "forward") {
  const pages = document.querySelectorAll(".settings-page");
  pages.forEach((p) => {
    p.classList.add("hidden");
    p.classList.remove("anim-forward", "anim-back");
  });
  const target = document.getElementById(pageId);
  if (!target) return;
  target.classList.remove("hidden");
  const animClass = direction === "back" ? "anim-back" : "anim-forward";
  target.classList.add(animClass);
  // remove animation class after it finishes so it can replay
  target.addEventListener("animationend", () => target.classList.remove(animClass), { once: true });
}

function navigateFromSettings(panelId) {
  state.utilityReturnSheet = "settingsSheet";
  openUtilityPanel(panelId);
  const panel = document.getElementById(panelId);
  if (panel) {
    panel.classList.add("panel-entering");
    panel.addEventListener("animationend", () => panel.classList.remove("panel-entering"), { once: true });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const openGeneral = document.getElementById("settingsOpenGeneral");
  if (openGeneral) openGeneral.addEventListener("click", () => showSettingsPage("settingsPageGeneral", "forward"));

  const backFromGeneral = document.getElementById("settingsBackFromGeneral");
  if (backFromGeneral) backFromGeneral.addEventListener("click", () => showSettingsPage("settingsPageMain", "back"));

  const openWidgets = document.getElementById("settingsOpenWidgets");
  if (openWidgets) {
    openWidgets.addEventListener("click", () => {
      state.widgetsOpenedFromDashboard = false;
      showSettingsPage("settingsPageWidgets", "forward");
    });
  }

  const dashWidgetsEditBtn = document.getElementById("dashWidgetsEditBtn");
  if (dashWidgetsEditBtn) {
    dashWidgetsEditBtn.addEventListener("click", () => {
      openSheet("settingsSheet");
      state.widgetsOpenedFromDashboard = true;
      showSettingsPage("settingsPageWidgets", "forward");
    });
  }

  const backFromWidgets = document.getElementById("settingsBackFromWidgets");
  if (backFromWidgets) {
    backFromWidgets.addEventListener("click", () => {
      if (state.widgetsOpenedFromDashboard) {
        state.widgetsOpenedFromDashboard = false;
        closeSheet("settingsSheet");
        return;
      }
      showSettingsPage("settingsPageMain", "back");
    });
  }

  const navMap = {
    settingsLinkAccounts:   "accountsPanel",
    settingsLinkBudget:     "budgetsPanel",
    settingsLinkCategories: "categoriesPanel",
    settingsLinkReview:     "reviewPanel",
    settingsLinkAi:         "settingsPanel",
  };
  for (const [id, panelId] of Object.entries(navMap)) {
    const btn = document.getElementById(id);
    if (btn) btn.addEventListener("click", () => navigateFromSettings(panelId));
  }

  // Panel back buttons — same behavior as #closeUtilityBtn
  for (const btn of document.querySelectorAll(".panel-back-btn")) {
    btn.addEventListener("click", () => {
      const returnSheet = state.utilityReturnSheet || "";
      closeUtilityPanel();
      if (returnSheet) {
        state.utilityReturnSheet = "";
        openSheet(returnSheet);
      }
    });
  }
});

// ── Panel form toggles ────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  function bindToggle(btnId, wrapId, resetFn) {
    const btn = document.getElementById(btnId);
    const wrap = document.getElementById(wrapId);
    if (!btn || !wrap) return;
    btn.addEventListener("click", () => {
      const isHidden = wrap.classList.contains("hidden");
      wrap.classList.toggle("hidden", !isHidden);
      if (!isHidden && resetFn) resetFn();
    });
  }

  // Accounts
  bindToggle("toggleAccountFormBtn", "accountCreateWrap", () => {
    const f = document.getElementById("accountForm");
    if (f) f.reset();
  });


  // Agent token
  const openAgentTokenBtn = document.getElementById("toggleAgentFormBtn");
  if (openAgentTokenBtn) {
    openAgentTokenBtn.addEventListener("click", () => {
      const form = document.getElementById("agentTokenForm");
      if (form instanceof HTMLFormElement) form.reset();
      openSheet("agentTokenCreateSheet", { preserveUtility: true });
    });
  }

  // Budget scope toggle (Monthly / Yearly)
  const monthlyBtn = document.getElementById("budgetToggleMonthly");
  const yearlyBtn = document.getElementById("budgetToggleYearly");
  const monthlyCard = document.getElementById("budgetMonthlyCard");
  const yearlyCard = document.getElementById("budgetYearlyCard");
  if (monthlyBtn && yearlyBtn && monthlyCard && yearlyCard) {
    monthlyBtn.addEventListener("click", () => {
      monthlyBtn.classList.add("active");
      yearlyBtn.classList.remove("active");
      monthlyCard.classList.remove("hidden");
      yearlyCard.classList.add("hidden");
    });
    yearlyBtn.addEventListener("click", () => {
      yearlyBtn.classList.add("active");
      monthlyBtn.classList.remove("active");
      yearlyCard.classList.remove("hidden");
      monthlyCard.classList.add("hidden");
    });
  }

  // Budget panel — add category button (syncs with Categories panel)
  const budgetAddCatBtn = document.getElementById("budgetAddCategoryBtn");
  if (budgetAddCatBtn) {
    budgetAddCatBtn.addEventListener("click", () => {
      void createL1CategoryInline();
    });
  }
});
