import { convexApi, createClient, serviceArgs } from "./base";

export type InvoiceRecurringSeriesRecord = {
  id: string;
  customerId: string | null;
  customerName: string | null;
  status: string;
  nextScheduledAt: string | null;
  upcomingNotificationSentAt: string | null;
  payload: unknown;
  createdAt: string;
  updatedAt: string;
};

export async function upsertInvoiceRecurringSeriesInConvex(args: {
  teamId: string;
  id: string;
  customerId?: string | null;
  customerName?: string | null;
  status: string;
  nextScheduledAt?: string | null;
  upcomingNotificationSentAt?: string | null;
  payload: Record<string, unknown>;
}) {
  return createClient().mutation(
    convexApi.invoiceRecurringSeries.serviceUpsertInvoiceRecurringSeries,
    serviceArgs({
      publicTeamId: args.teamId,
      invoiceRecurringId: args.id,
      customerId: args.customerId,
      customerName: args.customerName,
      status: args.status,
      nextScheduledAt: args.nextScheduledAt,
      upcomingNotificationSentAt: args.upcomingNotificationSentAt,
      payload: args.payload,
    }),
  ) as Promise<InvoiceRecurringSeriesRecord>;
}

export async function getInvoiceRecurringSeriesByLegacyIdFromConvex(args: {
  id: string;
}) {
  return createClient().query(
    convexApi.invoiceRecurringSeries.serviceGetInvoiceRecurringSeriesByLegacyId,
    serviceArgs({
      invoiceRecurringId: args.id,
    }),
  ) as Promise<InvoiceRecurringSeriesRecord | null>;
}

export async function getInvoiceRecurringSeriesByTeamFromConvex(args: {
  teamId: string;
}) {
  return createClient().query(
    convexApi.invoiceRecurringSeries.serviceGetInvoiceRecurringSeriesByTeam,
    serviceArgs({
      publicTeamId: args.teamId,
    }),
  ) as Promise<InvoiceRecurringSeriesRecord[]>;
}

export async function getDueInvoiceRecurringSeriesFromConvex(args: {
  before: string;
  limit?: number;
}) {
  return createClient().query(
    convexApi.invoiceRecurringSeries.serviceGetDueInvoiceRecurringSeries,
    serviceArgs({
      before: args.before,
      limit: args.limit,
    }),
  ) as Promise<InvoiceRecurringSeriesRecord[]>;
}

export async function getUpcomingInvoiceRecurringSeriesFromConvex(args: {
  after: string;
  before: string;
  limit?: number;
}) {
  return createClient().query(
    convexApi.invoiceRecurringSeries.serviceGetUpcomingInvoiceRecurringSeries,
    serviceArgs({
      after: args.after,
      before: args.before,
      limit: args.limit,
    }),
  ) as Promise<InvoiceRecurringSeriesRecord[]>;
}
