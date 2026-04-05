export type GetInsightActivityDataParams = {
  teamId: string;
  from: string;
  to: string;
  currency: string;
};

export type InsightActivityData = {
  invoicesSent: number;
  invoicesPaid: number;
  largestPayment?: { customer: string; amount: number };
  hoursTracked: number;
  unbilledHours: number;
  billableAmount: number;
  newCustomers: number;
  receiptsMatched: number;
  transactionsCategorized: number;
};
