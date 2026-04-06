import { getCustomerByPortalIdFromConvex } from "@tamias/app-data-convex";
import type { Database } from "../../client";
import { reuseQueryResult } from "../../utils/request-cache";
import { getTeamById } from "../index";
import { getProjectedInvoicesForCustomers } from "./shared";
import type { GetCustomerByPortalIdParams, GetCustomerPortalInvoicesParams } from "./types";

async function getCustomerByPortalIdImpl(db: Database, params: GetCustomerByPortalIdParams) {
  const customer = await getCustomerByPortalIdFromConvex({
    portalId: params.portalId,
  });

  if (!customer) {
    return null;
  }

  const team = await getTeamById(db, customer.teamId);

  if (!team) {
    return null;
  }

  return {
    ...customer,
    team: {
      id: team.id,
      name: team.name,
      logoUrl: team.logoUrl,
      baseCurrency: team.baseCurrency,
    },
  };
}

export const getCustomerByPortalId = reuseQueryResult({
  keyPrefix: "customer-by-portal-id",
  keyFn: (params: GetCustomerByPortalIdParams) => params.portalId,
  load: getCustomerByPortalIdImpl,
});

async function getCustomerPortalInvoicesImpl(
  _db: Database,
  params: GetCustomerPortalInvoicesParams,
) {
  const { customerId, teamId, cursor, pageSize = 10 } = params;
  const offset = cursor ? Number.parseInt(cursor, 10) : 0;
  const allInvoices = (await getProjectedInvoicesForCustomers(teamId, [customerId]))
    .filter(
      (invoice) =>
        invoice.customerId === customerId &&
        (invoice.status === "paid" || invoice.status === "unpaid" || invoice.status === "overdue"),
    )
    .sort((left, right) => (right.issueDate ?? "").localeCompare(left.issueDate ?? ""));
  const data = allInvoices.slice(offset, offset + pageSize).map((invoice) => ({
    id: invoice.id,
    invoiceNumber: null,
    status: invoice.status,
    amount: invoice.amount,
    currency: invoice.currency,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    token: invoice.token,
  }));

  const nextCursor = data.length === pageSize ? (offset + pageSize).toString() : null;

  return {
    data,
    nextCursor,
    hasMore: data.length === pageSize,
  };
}

export const getCustomerPortalInvoices = reuseQueryResult({
  keyPrefix: "customer-portal-invoices",
  keyFn: (params: GetCustomerPortalInvoicesParams) =>
    [params.teamId, params.customerId, params.cursor ?? "", params.pageSize ?? 10].join(":"),
  load: getCustomerPortalInvoicesImpl,
});
