import type { Database } from "../../../client";
import { syncPublicInvoiceComplianceJournalEntry } from "../../compliance/ledger";
import { deletePublicInvoice } from "../../public-invoices";
import { getInvoiceById } from "../reads";

export type DeleteInvoiceParams = {
  id: string;
  teamId: string;
};

export async function deleteInvoice(db: Database, params: DeleteInvoiceParams) {
  const { id, teamId } = params;
  const existing = await getInvoiceById(db, { id, teamId });

  if (!existing || !["draft", "canceled"].includes(existing.status)) {
    return null;
  }

  await deletePublicInvoice(db, {
    teamId,
    id,
  });
  await syncPublicInvoiceComplianceJournalEntry(db, {
    teamId,
    previous: existing,
    next: null,
  });

  return { id };
}
