import { convexApi, createClient, serviceArgs } from "./base";

export type PublicInvoiceRecord = {
  id: string;
  token: string;
  status: string;
  paymentIntentId: string | null;
  viewedAt: string | null;
  invoiceNumber: string | null;
  invoiceRecurringId?: string | null;
  recurringSequence?: number | null;
  payload: unknown;
  createdAt: string;
  updatedAt: string;
};

export type PublicInvoiceFilterDateField =
  | "createdAt"
  | "issueDate"
  | "sentAt"
  | "dueDate"
  | "paidAt";

export async function upsertPublicInvoiceInConvex(args: {
  teamId: string;
  id: string;
  token: string;
  status: string;
  paymentIntentId?: string | null;
  viewedAt?: string | null;
  invoiceNumber?: string | null;
  payload: Record<string, unknown>;
}) {
  return createClient().mutation(
    convexApi.publicInvoices.serviceUpsertPublicInvoice,
    serviceArgs({
      publicTeamId: args.teamId,
      invoiceId: args.id,
      token: args.token,
      status: args.status,
      paymentIntentId: args.paymentIntentId,
      viewedAt: args.viewedAt,
      invoiceNumber: args.invoiceNumber,
      payload: args.payload,
    }),
  ) as Promise<PublicInvoiceRecord>;
}

export async function getPublicInvoiceByPublicInvoiceIdFromConvex(args: {
  invoiceId: string;
}) {
  return createClient().query(
    convexApi.publicInvoices.serviceGetPublicInvoiceByPublicInvoiceId,
    serviceArgs({
      publicInvoiceId: args.invoiceId,
    }),
  ) as Promise<PublicInvoiceRecord | null>;
}

export async function getPublicInvoiceByTokenFromConvex(args: {
  token: string;
}) {
  return createClient().query(
    convexApi.publicInvoices.serviceGetPublicInvoiceByToken,
    serviceArgs({
      token: args.token,
    }),
  ) as Promise<PublicInvoiceRecord | null>;
}

export async function getPublicInvoicesByTeamFromConvex(args: {
  teamId: string;
}) {
  return createClient().query(
    convexApi.publicInvoices.serviceGetPublicInvoicesByTeam,
    serviceArgs({
      publicTeamId: args.teamId,
    }),
  ) as Promise<PublicInvoiceRecord[]>;
}

export async function getPublicInvoicesByIdsFromConvex(args: {
  teamId: string;
  invoiceIds: string[];
}) {
  return createClient().query(
    convexApi.publicInvoices.serviceGetPublicInvoicesByIds,
    serviceArgs({
      publicTeamId: args.teamId,
      invoiceIds: args.invoiceIds,
    }),
  ) as Promise<PublicInvoiceRecord[]>;
}

export async function getPublicInvoicesByCustomerIdsFromConvex(args: {
  teamId: string;
  customerIds: string[];
}) {
  return createClient().query(
    convexApi.publicInvoices.serviceGetPublicInvoicesByCustomerIds,
    serviceArgs({
      publicTeamId: args.teamId,
      customerIds: args.customerIds,
    }),
  ) as Promise<PublicInvoiceRecord[]>;
}

export async function getPublicInvoicesPageFromConvex(args: {
  teamId: string;
  cursor?: string | null;
  pageSize: number;
  status?: string;
  order?: "asc" | "desc";
  createdAtFrom?: string;
  createdAtTo?: string;
}) {
  return createClient().query(
    convexApi.publicInvoices.serviceListPublicInvoicesPage,
    serviceArgs({
      publicTeamId: args.teamId,
      status: args.status,
      order: args.order,
      createdAtFrom: args.createdAtFrom,
      createdAtTo: args.createdAtTo,
      paginationOpts: {
        numItems: args.pageSize,
        cursor: args.cursor ?? null,
      },
    }),
  ) as Promise<{
    page: PublicInvoiceRecord[];
    isDone: boolean;
    continueCursor: string;
  }>;
}

export async function searchPublicInvoicesFromConvex(args: {
  teamId: string;
  query: string;
  status?: string | null;
  limit?: number;
}) {
  return createClient().query(
    convexApi.publicInvoices.serviceSearchPublicInvoices,
    serviceArgs({
      publicTeamId: args.teamId,
      query: args.query,
      status: args.status ?? null,
      limit: args.limit,
    }),
  ) as Promise<PublicInvoiceRecord[]>;
}

export async function getPublicInvoicesByFiltersFromConvex(args: {
  teamId: string;
  statuses?: string[];
  currency?: string;
  dateField?: PublicInvoiceFilterDateField;
  from?: string;
  to?: string;
}) {
  return createClient().query(
    convexApi.publicInvoices.serviceGetPublicInvoicesByFilters,
    serviceArgs({
      publicTeamId: args.teamId,
      statuses: args.statuses,
      currency: args.currency,
      dateField: args.dateField,
      from: args.from,
      to: args.to,
    }),
  ) as Promise<PublicInvoiceRecord[]>;
}

export async function getPublicInvoiceByTeamAndInvoiceNumberFromConvex(args: {
  teamId: string;
  invoiceNumber: string;
}) {
  return createClient().query(
    convexApi.publicInvoices.serviceGetPublicInvoiceByTeamAndInvoiceNumber,
    serviceArgs({
      publicTeamId: args.teamId,
      invoiceNumber: args.invoiceNumber,
    }),
  ) as Promise<PublicInvoiceRecord | null>;
}

export async function getPublicInvoiceByRecurringSequenceFromConvex(args: {
  teamId: string;
  invoiceRecurringId: string;
  recurringSequence: number;
}) {
  return createClient().query(
    convexApi.publicInvoices.serviceGetPublicInvoiceByRecurringSequence,
    serviceArgs({
      publicTeamId: args.teamId,
      invoiceRecurringId: args.invoiceRecurringId,
      recurringSequence: args.recurringSequence,
    }),
  ) as Promise<PublicInvoiceRecord | null>;
}

export async function getPublicInvoicesByRecurringIdFromConvex(args: {
  teamId: string;
  invoiceRecurringId: string;
  statuses?: string[];
}) {
  return createClient().query(
    convexApi.publicInvoices.serviceGetPublicInvoicesByRecurringId,
    serviceArgs({
      publicTeamId: args.teamId,
      invoiceRecurringId: args.invoiceRecurringId,
      statuses: args.statuses,
    }),
  ) as Promise<PublicInvoiceRecord[]>;
}

export async function getNextInvoiceNumberPreviewFromConvex(args: {
  teamId: string;
}) {
  return createClient().query(
    convexApi.publicInvoices.serviceGetNextInvoiceNumberPreview,
    serviceArgs({
      publicTeamId: args.teamId,
    }),
  ) as Promise<string>;
}

export async function allocateNextInvoiceNumberInConvex(args: {
  teamId: string;
}) {
  return createClient().mutation(
    convexApi.publicInvoices.serviceAllocateNextInvoiceNumber,
    serviceArgs({
      publicTeamId: args.teamId,
    }),
  ) as Promise<string>;
}

export async function getPublicInvoicesByStatusesFromConvex(args: {
  statuses: string[];
}) {
  return createClient().query(
    convexApi.publicInvoices.serviceGetPublicInvoicesByStatuses,
    serviceArgs({
      statuses: args.statuses,
    }),
  ) as Promise<PublicInvoiceRecord[]>;
}

export async function getPublicInvoiceByPaymentIntentIdFromConvex(args: {
  paymentIntentId: string;
}) {
  return createClient().query(
    convexApi.publicInvoices.serviceGetPublicInvoiceByPaymentIntentId,
    serviceArgs({
      paymentIntentId: args.paymentIntentId,
    }),
  ) as Promise<PublicInvoiceRecord | null>;
}

export async function deletePublicInvoiceInConvex(args: {
  teamId: string;
  id: string;
}) {
  return createClient().mutation(
    convexApi.publicInvoices.serviceDeletePublicInvoice,
    serviceArgs({
      publicTeamId: args.teamId,
      invoiceId: args.id,
    }),
  ) as Promise<PublicInvoiceRecord | null>;
}
