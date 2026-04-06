import {
  getPublicInvoiceByPublicInvoiceIdFromConvex,
  getPublicInvoicesByIdsFromConvex,
} from "@tamias/app-data-convex";
import {
  type InvoiceByIdResult,
  type ProjectedInvoiceRecord,
  getProjectedInvoicePayload,
} from "../shared";
import type { GetInvoiceByIdParams } from "../types";

function toInvoiceListItem(invoice: ProjectedInvoiceRecord) {
  return {
    ...invoice,
    customer: {
      id: invoice.customer.id,
      name: invoice.customer.name,
      website: invoice.customer.website,
      email: invoice.customer.email,
    },
    team: {
      name: invoice.team.name,
    },
    recurring: {
      id: invoice.recurring.id,
      status: invoice.recurring.status,
      frequency: invoice.recurring.frequency,
      frequencyInterval: invoice.recurring.frequencyInterval,
      endType: invoice.recurring.endType,
      endCount: invoice.recurring.endCount,
      invoicesGenerated: invoice.recurring.invoicesGenerated,
      nextScheduledAt: invoice.recurring.nextScheduledAt,
    },
  };
}

export function buildInvoicePageResponse(args: {
  invoices: ProjectedInvoiceRecord[];
  cursor: string | null | undefined;
  nextCursor: string | null | undefined;
  hasNextPage: boolean;
}) {
  return {
    meta: {
      cursor: args.nextCursor ?? null,
      hasPreviousPage: Boolean(args.cursor),
      hasNextPage: args.hasNextPage,
    },
    data: args.invoices.map(toInvoiceListItem),
  };
}

export async function getProjectedInvoicesByIdsInOrder(args: {
  teamId: string;
  invoiceIds: string[];
}) {
  if (args.invoiceIds.length === 0) {
    return [];
  }

  const records = await getPublicInvoicesByIdsFromConvex({
    teamId: args.teamId,
    invoiceIds: args.invoiceIds,
  });
  const invoicesById = new Map(
    records.flatMap((record) => {
      const payload = getProjectedInvoicePayload(record);

      return payload && payload.teamId === args.teamId ? [[record.id, payload]] : [];
    }),
  );

  return args.invoiceIds.flatMap((invoiceId) => {
    const invoice = invoicesById.get(invoiceId);

    return invoice ? [invoice] : [];
  });
}

export async function getInvoiceById(
  params: GetInvoiceByIdParams,
): Promise<InvoiceByIdResult | null> {
  const { id, teamId } = params;
  const projected = await getPublicInvoiceByPublicInvoiceIdFromConvex({
    invoiceId: id,
  });
  const payload = getProjectedInvoicePayload(projected);

  if (!payload) {
    return null;
  }

  if (teamId !== undefined && payload.teamId !== teamId) {
    return null;
  }

  return payload;
}
