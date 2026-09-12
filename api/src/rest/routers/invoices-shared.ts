import type { Session } from "@tamias/auth-session";
import { getRestInvoiceTotals } from "../../invoice/rest-totals";
import { createLoggerWithContext } from "@tamias/logger";
import { getApiUrl, getAppUrl } from "@tamias/utils/envs";
import { HTTPException } from "hono/http-exception";
import { requireSessionUserId } from "../../invoice/transport";

type RestInvoiceTemplate = {
  currency?: string | null;
  taxRate?: number | null;
  vatRate?: number | null;
  includeVat?: boolean | null;
  includeTax?: boolean | null;
  includeLineItemTax?: boolean | null;
};

type RestInvoiceLineItem = {
  price?: number | string | null;
  quantity?: number | string | null;
  taxRate?: number | string | null;
};

type RestInvoiceLike = {
  token?: string | null;
  lineItems?: RestInvoiceLineItem[] | null;
  currency?: string | null;
  template?: RestInvoiceTemplate | null;
  discount?: number | null;
  paymentDetails?: unknown;
  customerDetails?: unknown;
  fromDetails?: unknown;
  noteDetails?: unknown;
  topBlock?: unknown;
  bottomBlock?: unknown;
  [key: string]: unknown;
};

export const restInvoiceLogger = createLoggerWithContext("rest:invoices");

function serializeJsonValue(value: unknown) {
  return value ? JSON.stringify(value) : null;
}

function getInvoiceCalculatedAmounts(invoice: RestInvoiceLike) {
  if (!invoice.lineItems || invoice.lineItems.length === 0) {
    return {};
  }

  return getRestInvoiceTotals({
    lineItems: invoice.lineItems.map((item) => ({
      price: typeof item.price === "number" ? item.price : Number(item.price) || 0,
      quantity: typeof item.quantity === "number" ? item.quantity : Number(item.quantity) || 0,
      taxRate: typeof item.taxRate === "number" ? item.taxRate : Number(item.taxRate) || 0,
    })),
    currency: invoice.currency,
    template: invoice.template,
    discount: invoice.discount ?? 0,
  });
}

function getInvoiceUrls(token: string | null | undefined) {
  return {
    pdfUrl: token ? `${getApiUrl()}/files/download/invoice?token=${token}` : null,
    previewUrl: token ? `${getAppUrl()}/i/${token}` : null,
  };
}

export function serializeInvoiceForRest<T extends RestInvoiceLike>(invoice: T) {
  const { token, ...invoiceWithoutToken } = invoice;

  return {
    ...invoiceWithoutToken,
    ...getInvoiceCalculatedAmounts(invoice),
    paymentDetails: serializeJsonValue(invoice.paymentDetails),
    customerDetails: serializeJsonValue(invoice.customerDetails),
    fromDetails: serializeJsonValue(invoice.fromDetails),
    noteDetails: serializeJsonValue(invoice.noteDetails),
    topBlock: serializeJsonValue(invoice.topBlock),
    bottomBlock: serializeJsonValue(invoice.bottomBlock),
    ...getInvoiceUrls(token),
  };
}

export function serializeInvoicePageForRest<
  T extends {
    data: RestInvoiceLike[];
    [key: string]: unknown;
  },
>(result: T) {
  return {
    ...result,
    data: result.data.map((invoice) => serializeInvoiceForRest(invoice)),
  };
}

export function requireRestUserId(session: Session) {
  return requireSessionUserId(session, () => {
    throw new HTTPException(401, { message: "Missing user id" });
  });
}
