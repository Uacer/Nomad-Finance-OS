const TRANSACTION_TYPES = ["income", "expense", "transfer"];
const TRANSFER_REASONS = ["normal", "deposit_lock", "deposit_release", "loan", "borrow"];
const ACCOUNT_TYPES = [
  "bank",
  "cash",
  "wise",
  "crypto_wallet",
  "exchange",
  "alipay",
  "wechat",
  "restricted_cash"
];
const ACCOUNT_MEMBER_ROLES = ["owner", "editor", "viewer"];
const ACCOUNT_ANALYTICS_MODES = ["wallet_only", "member_rollup"];

const DEFAULT_EXPENSE_CATEGORIES = {
  Living: ["Rent", "Utilities", "Groceries", "Healthcare"],
  Travel: ["Flights", "Hotels", "Visa", "Local Transport"],
  Work: ["SaaS", "Coworking", "Equipment", "Contractor"],
  Investment: ["Broker Fees", "On-chain Fees", "Custody"],
  Lifestyle: ["Dining", "Entertainment", "Shopping", "Fitness"],
  Study: ["Courses", "Books", "Certification", "Workshops"]
};

const SUPPORTED_CURRENCIES = ["AUD", "CNY", "EUR", "THB", "USD", "JPY", "KRW"];
const FIXED_COST_L2 = new Set(["Rent", "Utilities", "Coworking", "SaaS"]);

module.exports = {
  TRANSACTION_TYPES,
  TRANSFER_REASONS,
  ACCOUNT_TYPES,
  ACCOUNT_MEMBER_ROLES,
  ACCOUNT_ANALYTICS_MODES,
  DEFAULT_EXPENSE_CATEGORIES,
  SUPPORTED_CURRENCIES,
  FIXED_COST_L2
};
