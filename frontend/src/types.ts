export type Theme = "light" | "dark" | "glass" | "system";
export type EntryType = "income" | "expense";
export interface Wallet {
  id: number;
  name: string;
  opening_balance: number;
  balance: number;
  created_at?: string;
}
export interface Transaction {
  id: number;
  description: string;
  amount: number;
  type: EntryType;
  category: string;
  wallet_id: number;
  date: string;
  quantity?: number | null;
  unit?: string;
}
export interface Category {
  id: number;
  name: string;
  kind: string;
  bucket: string;
  color: string;
  icon: string;
  archived: boolean;
}
export interface Budget {
  id: number;
  category: string;
  amount: number;
  spent: number;
}
export interface Goal {
  id: number;
  name: string;
  target: number;
  due_date?: string | null;
  color: string;
}
export interface Saving {
  id: number;
  amount: number;
  category: string;
  wallet_id: number;
  goal_id: number | null;
  note: string;
  date: string;
}
export interface Loan {
  id: number;
  party: string;
  direction: "borrowed" | "lent";
  amount: number;
  repaid: number;
  date: string;
  note: string;
  due_date?: string | null;
}
export interface Movement {
  id: number;
  description: string;
  amount: number;
  from_wallet_id: number | null;
  to_wallet_id: number | null;
  kind: string;
  date: string;
  loan_id?: number | null;
}
export interface Regular {
  id: number;
  name: string;
  category: string;
  daily_limit: number;
  unit: string;
}
export interface Settings {
  name: string;
  theme: Theme;
  language: "en" | "bn";
  review_before_saving: boolean;
  tutorial_seen: boolean;
  ai_enabled: boolean;
  currency: string;
  bottom_nav: Route;
  monthly_budget: number;
  planned_income: number;
  savings_target: number;
  needs_percent: number;
  wants_percent: number;
  savings_percent: number;
}
export interface Planning {
  month: string;
  budget: number;
  spent: number;
  income: number;
  days_left: number;
  daily_limit: number;
  today_remaining: number;
  today_spent: number;
  remaining: number;
  available: number;
  monthly_saved: number;
  reserved: number;
  owed: number;
  receivable: number;
  forecast: number;
  daily_average: number;
  savings_rate: number | null;
  groups: { name: string; percent: number; target: number; spent: number }[];
}
export interface WorkspaceState {
  revision: number;
  wallets: Wallet[];
  transactions: Transaction[];
  categories: string[];
  category_details: Category[];
  budgets: Budget[];
  goals: Goal[];
  savings: Saving[];
  loans: Loan[];
  movements: Movement[];
  regulars: Regular[];
  settings: Settings;
  planning: Planning;
  advisor_messages: {
    id: number;
    role: string;
    content: string;
    provider: string;
  }[];
  wallet_openings: {
    id: number;
    amount: number;
    name: string;
    date: string | null;
  }[];
}
export interface CloudStatus {
  name?: string;
  offline?: boolean;
  mfa_required?: boolean;
  factors?: {
    id: string;
    factor_type: string;
    friendly_name?: string;
    status: string;
  }[];
  signed_in: boolean;
  configured: boolean;
  setup_required?: boolean;
  email?: string;
  message?: string;
  revision?: number;
  sync_state?: string;
  backend_url?: string;
}
export interface Provider {
  id: string;
  name: string;
  model: string;
  enabled: boolean;
  configured: boolean;
  priority: number;
  base_url: string;
  last_error?: string;
  cooldown_seconds?: number;
}
export interface Extraction {
  wallets: {
    name: string;
    balance: number;
    expected_balance?: number | null;
    existing?: boolean;
  }[];
  transactions: Omit<Transaction, "id">[];
  provider: string;
}
export type Values = Record<
  string,
  string | number | boolean | null | undefined
>;
export interface Plan {
  monthly_budget: number;
  planned_income: number;
  savings_target: number;
  needs_percent: number;
  wants_percent: number;
  savings_percent: number;
  allocations?: { category: string; amount: number }[];
}
export type Route =
  | "home"
  | "history"
  | "insights"
  | "hub"
  | "budgets"
  | "wallets"
  | "goals"
  | "loans"
  | "regulars"
  | "parser"
  | "settings"
  | "general"
  | "categories"
  | "connections"
  | "data"
  | "password"
  | "security"
  | "more";
