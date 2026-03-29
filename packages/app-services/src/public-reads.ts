import type { Database } from "@tamias/app-data/client";
import {
  getCustomerByPortalId,
  getCustomerInvoiceSummary,
  getCustomerPortalInvoices,
  type GetCustomerPortalInvoicesParams,
} from "@tamias/app-data/queries/customers";
import {
  getChartDataByLinkId,
  getReportByLinkId,
} from "@tamias/app-data/queries/reports";
import { getShortLinkByShortId } from "@tamias/app-data/queries/short-links";

export async function getCustomerPortalData(args: {
  db: Database;
  portalId: string;
}) {
  const customer = await getCustomerByPortalId(args.db, {
    portalId: args.portalId,
  });

  if (!customer) {
    return null;
  }

  const summary = await getCustomerInvoiceSummary(args.db, {
    customerId: customer.id,
    teamId: customer.teamId,
  });

  return {
    customer,
    summary,
  };
}

export async function getCustomerPortalInvoicesPage(args: {
  db: Database;
  portalId: string;
  cursor?: GetCustomerPortalInvoicesParams["cursor"];
  pageSize?: GetCustomerPortalInvoicesParams["pageSize"];
}) {
  const customer = await getCustomerByPortalId(args.db, {
    portalId: args.portalId,
  });

  if (!customer) {
    return { data: [], meta: { cursor: null } };
  }

  const result = await getCustomerPortalInvoices(args.db, {
    customerId: customer.id,
    teamId: customer.teamId,
    cursor: args.cursor,
    pageSize: args.pageSize,
  });

  return {
    data: result.data,
    meta: {
      cursor: result.nextCursor,
    },
  };
}

export async function getPublicReportByLinkId(args: {
  db: Database;
  linkId: string;
}) {
  return getReportByLinkId(args.db, args.linkId);
}

export async function getPublicReportChartDataByLinkId(args: {
  db: Database;
  linkId: string;
}) {
  return getChartDataByLinkId(args.db, args.linkId);
}

export async function getPublicShortLink(args: {
  db: Database;
  shortId: string;
}) {
  return getShortLinkByShortId(args.db, args.shortId);
}
