import type { Database, DatabaseOrTransaction } from "../../client";
import {
  allocateNextPublicInvoiceNumber,
  getNextInvoiceNumberPreview,
  getPublicInvoiceByTeamAndInvoiceNumber,
  INVOICE_NUMBER_CONFLICT_PREFIX,
} from "../public-invoices";

type SearchInvoiceNumberParams = {
  teamId: string;
  query: string;
};

export async function searchInvoiceNumber(db: Database, params: SearchInvoiceNumberParams) {
  const normalizedQuery = params.query.trim();

  if (!normalizedQuery) {
    return null;
  }

  const result = await getPublicInvoiceByTeamAndInvoiceNumber(db, {
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
  db: DatabaseOrTransaction,
  teamId: string,
): Promise<string> {
  return getNextInvoiceNumberPreview(db, { teamId });
}

export async function allocateNextInvoiceNumber(
  db: DatabaseOrTransaction,
  teamId: string,
): Promise<string> {
  return allocateNextPublicInvoiceNumber(db, { teamId });
}

export async function isInvoiceNumberUsed(
  db: Database,
  teamId: string,
  invoiceNumber: string,
): Promise<boolean> {
  const record = await getPublicInvoiceByTeamAndInvoiceNumber(db, {
    teamId,
    invoiceNumber,
  });

  return !!record;
}
