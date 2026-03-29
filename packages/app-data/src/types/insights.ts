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
