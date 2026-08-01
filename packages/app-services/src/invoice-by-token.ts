import { createDatabase, type Database } from "@tamias/app-data/client";
import { getPublicInvoiceByToken } from "@tamias/app-data/queries";

type InvoiceByTokenRecord = Awaited<
  ReturnType<typeof import("@tamias/app-data/queries").getInvoiceById>
>;

function normalizeInvoiceToken(token: string) {
  try {
    return decodeURIComponent(token);
  } catch {
    return token;
  }
}

export async function getInvoiceIdFromToken(
  token: string,
  db: Database = createDatabase(),
): Promise<string | null> {
  const record = await getPublicInvoiceByToken(db, {
    token: normalizeInvoiceToken(token),
  });

  return record?.id ?? null;
}

export async function getInvoiceByToken(
  token: string,
  db: Database = createDatabase(),
): Promise<InvoiceByTokenRecord | null> {
  const record = await getPublicInvoiceByToken(db, {
    token: normalizeInvoiceToken(token),
  });

  return (record?.payload ?? null) as InvoiceByTokenRecord | null;
}
