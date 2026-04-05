import type { DatabaseOrTransaction } from "../../../client";
import { getInvoiceById } from "../reads";
import { upsertProjectedInvoiceRecord } from "../shared";

export async function markInvoiceViewed(
  db: DatabaseOrTransaction,
  params: { id: string },
) {
  const existing = await getInvoiceById(db, { id: params.id });

  if (!existing) {
    return null;
  }

  const viewedAt = new Date().toISOString();

  await upsertProjectedInvoiceRecord(
    db,
    {
      ...existing,
      viewedAt,
      updatedAt: viewedAt,
    },
    {
      existing,
    },
  );

  return {
    id: existing.id,
    viewedAt,
  };
}
