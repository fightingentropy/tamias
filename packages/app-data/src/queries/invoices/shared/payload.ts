import type { InvoiceByIdResult } from "./types";

export function getProjectedInvoicePayload(
  record: { payload: unknown } | null | undefined,
): InvoiceByIdResult | null {
  const payload = record?.payload as InvoiceByIdResult | null;

  if (!payload || typeof payload !== "object") {
    return null;
  }

  return payload;
}

export function hasOwnKey(object: object, key: string) {
  return Object.hasOwn(object, key);
}
