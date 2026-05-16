export type TransactionFrequency =
  | "weekly"
  | "biweekly"
  | "monthly"
  | "semi_monthly"
  | "annually"
  | "irregular"
  | "unknown";

export type TransactionMetricAggregateRowRecord = {
  scope: "base" | "native";
  date: string;
  currency: string;
  direction: "income" | "expense";
  categorySlug: string | null;
  recurring: boolean;
  totalAmount: number;
  totalNetAmount: number | null;
  transactionCount: number;
  updatedAt: string;
};

export type TransactionRecurringAggregateRowRecord = {
  scope: "base" | "native";
  direction: "income" | "expense";
  currency: string;
  date: string;
  name: string;
  frequency: TransactionFrequency | null;
  categorySlug: string | null;
  totalAmount: number;
  transactionCount: number;
  latestAmount: number;
  latestTransactionCreatedAt: string;
  updatedAt: string;
};

export type TransactionTaxAggregateRowRecord = {
  scope: "base" | "native";
  date: string;
  currency: string;
  direction: "income" | "expense";
  categorySlug: string | null;
  taxType: string | null;
  taxRate: number;
  totalTaxAmount: number;
  totalTransactionAmount: number;
  transactionCount: number;
  updatedAt: string;
};

export type InvoiceAggregateRowRecord = {
  scopeKey: string;
  customerId: string | null;
  status: string;
  currency: string | null;
  invoiceCount: number;
  totalAmount: number;
  oldestDueDate: string | null;
  latestIssueDate: string | null;
  updatedAt: string;
};

export type InvoiceAggregateDateField = "issueDate" | "paidAt";
export type InvoiceCustomerAggregateDateField = "createdAt" | "paidAt";
export type InvoiceAnalyticsAggregateDateField = "createdAt" | "sentAt" | "paidAt";

export type InvoiceDateAggregateRowRecord = {
  status: string;
  dateField: InvoiceAggregateDateField;
  date: string;
  currency: string | null;
  recurring: boolean;
  invoiceCount: number;
  totalAmount: number;
  validPaymentCount: number;
  onTimeCount: number;
  totalDaysToPay: number;
  updatedAt: string;
};

export type InvoiceCustomerDateAggregateRowRecord = {
  customerId: string;
  status: string;
  dateField: InvoiceCustomerAggregateDateField;
  date: string;
  currency: string | null;
  invoiceCount: number;
  totalAmount: number;
  updatedAt: string;
};

export type InvoiceAnalyticsAggregateRowRecord = {
  dateField: InvoiceAnalyticsAggregateDateField;
  date: string;
  status: string;
  currency: string | null;
  dueDate: string | null;
  invoiceCount: number;
  totalAmount: number;
  issueToPaidValidCount: number;
  issueToPaidTotalDays: number;
  sentToPaidValidCount: number;
  sentToPaidTotalDays: number;
  updatedAt: string;
};

export type InvoiceAgingAggregateRowRecord = {
  status: string;
  currency: string | null;
  issueDate: string | null;
  dueDate: string | null;
  invoiceCount: number;
  totalAmount: number;
  updatedAt: string;
};
