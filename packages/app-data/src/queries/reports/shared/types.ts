import type {
  InboxLiabilityAggregateRowRecord,
  InvoiceAgingAggregateRowRecord,
  InvoiceDateAggregateRowRecord,
  TransactionMetricAggregateRowRecord,
  TransactionRecurringAggregateRowRecord,
  TransactionTaxAggregateRowRecord,
} from "@tamias/app-data-convex";

export type ReportTransactionAggregateRow = TransactionMetricAggregateRowRecord;
export type ReportTransactionRecurringAggregateRow = TransactionRecurringAggregateRowRecord;
export type ReportTransactionTaxAggregateRow = TransactionTaxAggregateRowRecord;
export type ReportInboxLiabilityAggregateRow = InboxLiabilityAggregateRowRecord;
export type ReportInvoiceDateAggregateRow = InvoiceDateAggregateRowRecord;
export type ReportInvoiceAgingAggregateRow = InvoiceAgingAggregateRowRecord;
export type RecurringFrequency =
  | "weekly"
  | "biweekly"
  | "monthly"
  | "semi_monthly"
  | "annually"
  | "irregular";
