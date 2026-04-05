import { deletePublicInvoiceInConvex } from "@tamias/app-data-convex";
import type { Database } from "../../../client";
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

  await deletePublicInvoiceInConvex({
    teamId,
    id,
  });

  return { id };
}
