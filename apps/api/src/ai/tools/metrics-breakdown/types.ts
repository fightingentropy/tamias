export type BreakdownSummary = {
  revenue: number;
  expenses: number;
  profit: number;
  transactionCount: number;
};

export type BreakdownTransaction = {
  id: string;
  date: string;
  name: string;
  amount: number;
  formattedAmount: string;
  category: string;
  type: "income" | "expense";
  vendor: string;
  percentage: number;
};

export type BreakdownCategory = {
  name: string;
  amount: number;
  percentage: number;
  transactionCount?: number;
  color?: string;
};

export type BreakdownPeriodResult = {
  summary: BreakdownSummary;
  transactions: BreakdownTransaction[];
  categories: BreakdownCategory[];
};

export type MonthlyPeriod = {
  from: string;
  to: string;
  monthKey: string;
};

export type MonthlyBreakdownData = {
  monthKey: string;
  monthLabel: string;
  revenue: number;
  expenses: number;
  profit: number;
  transactionCount: number;
  topCategories: Array<Pick<BreakdownCategory, "name" | "amount" | "percentage">>;
  topTransactions: Array<
    Pick<
      BreakdownTransaction,
      "name" | "amount" | "formattedAmount" | "category" | "percentage"
    >
  >;
};

export type AggregatedBreakdownTransaction = Pick<
  BreakdownTransaction,
  "name" | "amount" | "formattedAmount" | "category" | "percentage"
>;

export type AggregatedMonthlyBreakdown = {
  categories: BreakdownCategory[];
  transactions: AggregatedBreakdownTransaction[];
  formattedTransactions: BreakdownTransaction[];
};
