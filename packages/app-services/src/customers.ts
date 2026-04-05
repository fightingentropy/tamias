import type { Database } from "@tamias/app-data/client";
import {
  getCustomerById,
  getCustomerInvoiceSummary,
  getCustomers,
  type GetCustomerInvoiceSummaryParams,
  type GetCustomersParams,
} from "@tamias/app-data/queries/customers";
import { getCustomerPageSummary } from "@tamias/app-data/queries/customer-summary";

export async function getCustomersPage(args: {
  db: Database;
  teamId: string;
} & Omit<GetCustomersParams, "teamId">) {
  const { db, teamId, ...input } = args;

  return getCustomers(db, {
    teamId,
    ...input,
  });
}

export async function getCustomerByIdForTeam(args: {
  db: Database;
  teamId: string;
  id: string;
}) {
  const { db, teamId, id } = args;

  return getCustomerById(db, {
    teamId,
    id,
  });
}

export async function getCustomerInvoiceSummaryForTeam(args: {
  db: Database;
  teamId: string;
} & Omit<GetCustomerInvoiceSummaryParams, "teamId">) {
  const { db, teamId, ...input } = args;

  return getCustomerInvoiceSummary(db, {
    teamId,
    ...input,
  });
}

export async function getCustomerPageSummaryForTeam(args: {
  db: Database;
  teamId: string;
}) {
  return getCustomerPageSummary(args.db, {
    teamId: args.teamId,
  });
}
