import { getPublicInvoiceByTokenFromConvex } from "@tamias/app-data-convex";

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
): Promise<string | null> {
  const record = await getPublicInvoiceByTokenFromConvex({
    token: normalizeInvoiceToken(token),
  });

  return record?.id ?? null;
}

export async function getInvoiceByToken(
  token: string,
): Promise<InvoiceByTokenRecord | null> {
  const record = await getPublicInvoiceByTokenFromConvex({
    token: normalizeInvoiceToken(token),
  });

  return (record?.payload ?? null) as InvoiceByTokenRecord | null;
}
