import type { InboxLiabilityAggregateRowRecord } from "../../inbox/d1";
import type {
  InvoiceAgingAggregateRowRecord,
  InvoiceDateAggregateRowRecord,
  TransactionMetricAggregateRowRecord,
  TransactionRecurringAggregateRowRecord,
  TransactionTaxAggregateRowRecord,
} from "./aggregates/types";

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
