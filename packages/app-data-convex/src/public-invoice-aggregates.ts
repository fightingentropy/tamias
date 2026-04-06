import { convexApi, createClient, serviceArgs } from "./base";

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

export async function getInvoiceAggregateRowsFromConvex(args: {
  teamId: string;
  customerId?: string;
  statuses?: string[];
}) {
  return createClient().query(
    convexApi.publicInvoices.serviceGetInvoiceAggregateRows,
    serviceArgs({
      publicTeamId: args.teamId,
      customerId: args.customerId,
      statuses: args.statuses,
    }),
  ) as Promise<InvoiceAggregateRowRecord[]>;
}

export async function getInvoiceDateAggregateRowsFromConvex(args: {
  teamId: string;
  statuses: string[];
  dateField: InvoiceAggregateDateField;
  dateFrom?: string | null;
  dateTo?: string | null;
  currency?: string | null;
  recurring?: boolean;
}) {
  return createClient().query(
    convexApi.publicInvoices.serviceGetInvoiceDateAggregateRows,
    serviceArgs({
      publicTeamId: args.teamId,
      statuses: args.statuses,
      dateField: args.dateField,
      dateFrom: args.dateFrom,
      dateTo: args.dateTo,
      currency: args.currency,
      recurring: args.recurring,
    }),
  ) as Promise<InvoiceDateAggregateRowRecord[]>;
}

export async function getInvoiceCustomerDateAggregateRowsFromConvex(args: {
  teamId: string;
  statuses: string[];
  dateField: InvoiceCustomerAggregateDateField;
  dateFrom?: string | null;
  dateTo?: string | null;
  currency?: string | null;
}) {
  return createClient().query(
    convexApi.publicInvoices.serviceGetInvoiceCustomerDateAggregateRows,
    serviceArgs({
      publicTeamId: args.teamId,
      statuses: args.statuses,
      dateField: args.dateField,
      dateFrom: args.dateFrom,
      dateTo: args.dateTo,
      currency: args.currency,
    }),
  ) as Promise<InvoiceCustomerDateAggregateRowRecord[]>;
}

export async function getInvoiceAnalyticsAggregateRowsFromConvex(args: {
  teamId: string;
  dateField: InvoiceAnalyticsAggregateDateField;
  statuses?: string[];
  dateFrom?: string | null;
  dateTo?: string | null;
  currency?: string | null;
}) {
  return createClient().query(
    convexApi.publicInvoices.serviceGetInvoiceAnalyticsAggregateRows,
    serviceArgs({
      publicTeamId: args.teamId,
      dateField: args.dateField,
      statuses: args.statuses,
      dateFrom: args.dateFrom,
      dateTo: args.dateTo,
      currency: args.currency,
    }),
  ) as Promise<InvoiceAnalyticsAggregateRowRecord[]>;
}

export async function getInvoiceAgingAggregateRowsFromConvex(args: {
  teamId: string;
  statuses: string[];
  currency?: string | null;
}) {
  return createClient().query(
    convexApi.publicInvoices.serviceGetInvoiceAgingAggregateRows,
    serviceArgs({
      publicTeamId: args.teamId,
      statuses: args.statuses,
      currency: args.currency,
    }),
  ) as Promise<InvoiceAgingAggregateRowRecord[]>;
}

export async function rebuildInvoiceReportAggregatesInConvex(args: { teamId?: string | null }) {
  return createClient().mutation(
    convexApi.publicInvoices.serviceRebuildInvoiceReportAggregates,
    serviceArgs({
      publicTeamId: args.teamId ?? null,
    }),
  ) as Promise<
    Array<{
      teamId: string;
      invoiceCount: number;
      invoiceAggregateRows: number;
      invoiceDateAggregateRows: number;
      invoiceCustomerDateAggregateRows: number;
      invoiceAnalyticsAggregateRows: number;
      invoiceAgingAggregateRows: number;
    }>
  >;
}

export async function rebuildPublicInvoiceSearchTextsInConvex(args: { teamId?: string | null }) {
  return createClient().mutation(
    convexApi.publicInvoices.serviceRebuildPublicInvoiceSearchTexts,
    serviceArgs({
      publicTeamId: args.teamId ?? null,
    }),
  ) as Promise<
    Array<{
      teamId: string;
      invoiceCount: number;
      updatedInvoiceCount: number;
    }>
  >;
}
