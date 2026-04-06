export type {
  GetAverageDaysToPaymentParams,
  GetAverageInvoiceSizeParams,
} from "./analytics/averages";
export { getAverageDaysToPayment, getAverageInvoiceSize } from "./analytics/averages";
export type {
  GetInactiveClientsCountParams,
  GetMostActiveClientParams,
} from "./analytics/customer-summary";
export { getInactiveClientsCount, getMostActiveClient } from "./analytics/customer-summary";
export type {
  GetInvoicePaymentAnalysisParams,
  InvoicePaymentAnalysisResult,
} from "./analytics/payment-analysis";
export { getInvoicePaymentAnalysis } from "./analytics/payment-analysis";
