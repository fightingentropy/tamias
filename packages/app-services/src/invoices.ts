import type { Database } from "@tamias/app-data/client";
import {
  getInvoiceById,
  getInvoiceSummary,
  getInvoices,
  getPaymentStatus,
  searchInvoiceNumber,
  type GetInvoiceSummaryParams,
  type GetInvoicesParams,
} from "@tamias/app-data/queries";

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

export async function getInvoiceByIdForTeam(args: {
  db: Database;
  teamId: string;
  input: {
    id: string;
  };
}) {
  return getInvoiceById(args.db, {
    teamId: args.teamId,
    ...args.input,
  });
}

export async function getInvoicePaymentStatusForTeam(args: {
  db: Database;
  teamId: string;
}) {
  return getPaymentStatus(args.db, args.teamId);
}

export async function getInvoiceSummaryForTeam(args: {
  db: Database;
  teamId: string;
  input?: Omit<GetInvoiceSummaryParams, "teamId">;
}) {
  return getInvoiceSummary(args.db, {
    teamId: args.teamId,
    ...args.input,
  });
}

export async function searchInvoiceNumberForTeam(args: {
  db: Database;
  teamId: string;
  input: {
    query: string;
  };
}) {
  return searchInvoiceNumber(args.db, {
    teamId: args.teamId,
    ...args.input,
  });
}
