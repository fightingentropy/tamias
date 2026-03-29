import type { Database } from "@tamias/app-data/client";
import {
  type GetInvoiceSummaryParams,
  type GetInvoicesParams,
  getInvoiceSummary,
  getInvoices,
  getPaymentStatus,
} from "@tamias/app-data/queries/invoices";

export async function getInvoicesPage(args: {
  db: Database;
  teamId: string;
  input?: Omit<GetInvoicesParams, "teamId">;
}) {
  return getInvoices(args.db, {
    teamId: args.teamId,
    ...args.input,
  });
}

export async function getInvoiceSummaryForTeam(args: {
  db: Database;
  teamId: string;
  statuses?: GetInvoiceSummaryParams["statuses"];
}) {
  return getInvoiceSummary(args.db, {
    teamId: args.teamId,
    statuses: args.statuses,
  });
}

export async function getInvoicePaymentStatusForTeam(args: {
  db: Database;
  teamId: string;
}) {
  return getPaymentStatus(args.db, args.teamId);
}
