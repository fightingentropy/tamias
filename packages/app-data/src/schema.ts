type EnumLike<TValues extends readonly string[]> = {
  enumName: string;
  enumValues: TValues;
};

function createEnum<const TValues extends readonly string[]>(
  enumName: string,
  enumValues: TValues,
): EnumLike<TValues> {
  return {
    enumName,
    enumValues,
  };
}

export const accountTypeEnum = createEnum("account_type", [
  "depository",
  "credit",
  "other_asset",
  "loan",
  "other_liability",
] as const);

export const bankProvidersEnum = createEnum("bank_providers", ["plaid", "teller"] as const);

export const connectionStatusEnum = createEnum("connection_status", [
  "disconnected",
  "connected",
  "unknown",
] as const);

export const documentProcessingStatusEnum = createEnum("document_processing_status", [
  "pending",
  "processing",
  "completed",
  "failed",
] as const);

export const inboxStatusEnum = createEnum("inbox_status", [
  "processing",
  "pending",
  "archived",
  "new",
  "analyzing",
  "suggested_match",
  "no_match",
  "done",
  "deleted",
  "other",
] as const);

export const inboxTypeEnum = createEnum("inbox_type", ["invoice", "expense", "other"] as const);

export const invoiceDeliveryTypeEnum = createEnum("invoice_delivery_type", [
  "create",
  "create_and_send",
  "scheduled",
] as const);

export const invoiceSizeEnum = createEnum("invoice_size", ["a4", "letter"] as const);

export const invoiceStatusEnum = createEnum("invoice_status", [
  "draft",
  "overdue",
  "paid",
  "unpaid",
  "canceled",
  "scheduled",
  "refunded",
] as const);

export const invoiceRecurringFrequencyEnum = createEnum("invoice_recurring_frequency", [
  "weekly",
  "biweekly",
  "monthly_date",
  "monthly_weekday",
  "monthly_last_day",
  "quarterly",
  "semi_annual",
  "annual",
  "custom",
] as const);

export const invoiceRecurringEndTypeEnum = createEnum("invoice_recurring_end_type", [
  "never",
  "on_date",
  "after_count",
] as const);

export const invoiceRecurringStatusEnum = createEnum("invoice_recurring_status", [
  "active",
  "paused",
  "completed",
  "canceled",
] as const);

export const plansEnum = createEnum("plans", ["trial", "starter", "pro"] as const);

export const subscriptionStatusEnum = createEnum("subscription_status", [
  "active",
  "past_due",
] as const);

export const teamRolesEnum = createEnum("teamRoles", ["owner", "member"] as const);

export const transactionMethodsEnum = createEnum("transactionMethods", [
  "payment",
  "card_purchase",
  "card_atm",
  "transfer",
  "other",
  "unknown",
  "ach",
  "interest",
  "deposit",
  "wire",
  "fee",
] as const);

export const transactionStatusEnum = createEnum("transactionStatus", [
  "posted",
  "pending",
  "excluded",
  "completed",
  "archived",
  "exported",
] as const);

export const transactionFrequencyEnum = createEnum("transaction_frequency", [
  "weekly",
  "biweekly",
  "monthly",
  "semi_monthly",
  "annually",
  "irregular",
  "unknown",
] as const);

export const activityTypeEnum = createEnum("activity_type", [
  "transactions_enriched",
  "transactions_created",
  "invoice_paid",
  "inbox_new",
  "inbox_auto_matched",
  "inbox_needs_review",
  "inbox_cross_currency_matched",
  "invoice_overdue",
  "invoice_sent",
  "inbox_match_confirmed",
  "invoice_refunded",
  "recurring_series_started",
  "recurring_series_completed",
  "recurring_series_paused",
  "recurring_invoice_upcoming",
  "document_uploaded",
  "document_processed",
  "invoice_duplicated",
  "invoice_scheduled",
  "invoice_reminder_sent",
  "invoice_cancelled",
  "invoice_created",
  "draft_invoice_created",
  "tracker_entry_created",
  "tracker_project_created",
  "transactions_categorized",
  "transactions_assigned",
  "transaction_attachment_created",
  "transaction_category_created",
  "transactions_exported",
  "customer_created",
  "insight_ready",
] as const);

export const activityStatusEnum = createEnum("activity_status", [
  "unread",
  "read",
  "archived",
] as const);

export type InsightMetric = {
  type: string;
  label: string;
  value: number;
  previousValue: number;
  change: number;
  changeDirection: "up" | "down" | "flat";
  unit?: string;
  historicalContext?: string;
};

export type InsightAnomaly = {
  type: string;
  severity: "info" | "warning" | "alert";
  message: string;
  metricType?: string;
};

export type ExpenseAnomaly = {
  type: "category_spike" | "new_category" | "category_decrease";
  severity: "info" | "warning" | "alert";
  categoryName: string;
  categorySlug: string;
  currentAmount: number;
  previousAmount: number;
  change: number;
  currency: string;
  message: string;
  tip?: string;
};

export type InsightMilestone = {
  type: string;
  description: string;
  achievedAt: string;
};

export type InsightActivity = {
  invoicesSent: number;
  invoicesPaid: number;
  invoicesOverdue: number;
  overdueAmount?: number;
  hoursTracked: number;
  largestPayment?: { customer: string; amount: number };
  newCustomers: number;
  receiptsMatched: number;
  transactionsCategorized: number;
  upcomingInvoices?: {
    count: number;
    totalAmount: number;
    nextDueDate?: string;
    items?: Array<{
      customerName: string;
      amount: number;
      scheduledAt: string;
      frequency?: string;
    }>;
  };
};

export type InsightPredictions = {
  invoicesDue?: {
    count: number;
    totalAmount: number;
    currency: string;
  };
  streakAtRisk?: {
    type: string;
    count: number;
  };
  notes?: string[];
};

export type InsightContent = {
  title: string;
  summary: string;
  story: string;
  actions: Array<{
    text: string;
    type?: string;
    entityType?: "invoice" | "project" | "customer" | "transaction";
    entityId?: string;
  }>;
};
