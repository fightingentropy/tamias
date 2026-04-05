export type GetRevenueForecastParams = {
  teamId: string;
  from: string;
  to: string;
  forecastMonths: number;
  currency?: string;
  revenueType?: "gross" | "net";
};

export type RecurringTransactionProjection = Map<
  string,
  { amount: number; count: number }
>;

export interface TeamCollectionMetrics {
  onTimeRate: number;
  avgDaysToPay: number;
  sampleSize: number;
}

export interface ExpectedCollections {
  month1: number;
  month2: number;
  totalExpected: number;
  invoiceCount: number;
}

export interface ForecastBreakdown {
  recurringInvoices: number;
  recurringTransactions: number;
  scheduled: number;
  collections: number;
  billableHours: number;
  newBusiness: number;
}

export interface ConfidenceBounds {
  optimistic: number;
  pessimistic: number;
  confidence: number;
}

export interface ForecastDataPoint {
  date: string;
  value: number;
  currency: string;
  type: "actual" | "forecast";
}

export interface EnhancedForecastDataPoint extends ForecastDataPoint {
  optimistic: number;
  pessimistic: number;
  confidence: number;
  breakdown: ForecastBreakdown;
}
