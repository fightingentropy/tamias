import {
  allocateNextInvoiceNumberInConvex,
  getNextInvoiceNumberPreviewFromConvex,
  getPublicInvoiceByTeamAndInvoiceNumberFromConvex,
} from "@tamias/app-data-convex";
import type { Database, DatabaseOrTransaction } from "../../client";

const INVOICE_NUMBER_CONFLICT_PREFIX = "INVOICE_NUMBER_ALREADY_USED:";

type SearchInvoiceNumberParams = {
  teamId: string;
  query: string;
};

export async function searchInvoiceNumber(_db: Database, params: SearchInvoiceNumberParams) {
  const normalizedQuery = params.query.trim();

  if (!normalizedQuery) {
    return null;
  }

  const result = await getPublicInvoiceByTeamAndInvoiceNumberFromConvex({
    teamId: params.teamId,
    invoiceNumber: normalizedQuery,
  });

  return result
    ? {
        invoiceNumber: normalizedQuery,
      }
    : null;
}

export function getInvoiceNumberConflictMessage(invoiceNumber: string) {
  return `Invoice number '${invoiceNumber}' is already used. Please provide a different invoice number or omit it to auto-generate one.`;
}

export function isInvoiceNumberConflictError(error: unknown) {
  return error instanceof Error && error.message.includes(INVOICE_NUMBER_CONFLICT_PREFIX);
}

export async function getNextInvoiceNumber(
  _db: DatabaseOrTransaction,
  teamId: string,
): Promise<string> {
  return getNextInvoiceNumberPreviewFromConvex({ teamId });
}

export async function allocateNextInvoiceNumber(
  _db: DatabaseOrTransaction,
  teamId: string,
): Promise<string> {
  return allocateNextInvoiceNumberInConvex({ teamId });
}

export async function isInvoiceNumberUsed(
  _db: Database,
  teamId: string,
  invoiceNumber: string,
): Promise<boolean> {
  const record = await getPublicInvoiceByTeamAndInvoiceNumberFromConvex({
    teamId,
    invoiceNumber,
  });

  return !!record;
}
