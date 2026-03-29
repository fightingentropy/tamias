import type { Database } from "@tamias/app-data/client";
import { getCustomerPageSummary } from "@tamias/app-data/queries/customer-summary";
import {
  type GetCustomersParams,
  getCustomers,
} from "@tamias/app-data/queries/customers";

export async function getCustomersPage(args: {
  db: Database;
  teamId: string;
  input?: Omit<GetCustomersParams, "teamId">;
}) {
  return getCustomers(args.db, {
    teamId: args.teamId,
    ...args.input,
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
