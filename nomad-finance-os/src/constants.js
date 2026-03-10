const TRANSACTION_TYPES = ["income", "expense", "transfer"];
const TRANSFER_REASONS = ["normal", "deposit_lock", "deposit_release"];
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

const DEFAULT_EXPENSE_CATEGORIES = {
  Living: ["Rent", "Utilities", "Groceries", "Healthcare"],
  Travel: ["Flights", "Hotels", "Visa", "Local Transport"],
  Work: ["SaaS", "Coworking", "Equipment", "Contractor"],
  Investment: ["Broker Fees", "On-chain Fees", "Custody"],
  Lifestyle: ["Dining", "Entertainment", "Shopping", "Fitness"],
  Study: ["Courses", "Books", "Certification", "Workshops"]
};

const SUPPORTED_CURRENCIES = ["USD", "USDT", "THB", "RMB", "CNY", "SGD", "EUR", "GBP", "JPY"];
const FIXED_COST_L2 = new Set(["Rent", "Utilities", "Coworking", "SaaS"]);

module.exports = {
  TRANSACTION_TYPES,
  TRANSFER_REASONS,
  ACCOUNT_TYPES,
  DEFAULT_EXPENSE_CATEGORIES,
  SUPPORTED_CURRENCIES,
  FIXED_COST_L2
};
