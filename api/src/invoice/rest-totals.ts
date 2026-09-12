import { calculateTotal } from "@tamias/invoice/calculate";
import { getCurrencyMultiplier } from "@tamias/invoice/currency";

type TotalsInput = {
  lineItems: Array<{ price?: number; quantity?: number; taxRate?: number }>;
  currency?: string | null;
  discount?: number | null;
  template?: {
    currency?: string | null;
    taxRate?: number | null;
    vatRate?: number | null;
    includeVat?: boolean | null;
    includeTax?: boolean | null;
    includeLineItemTax?: boolean | null;
  } | null;
};

export function getRestInvoiceTotals(input: TotalsInput) {
  const template = input.template;
  const calculated = calculateTotal({
    lineItems: input.lineItems,
    taxRate: template?.taxRate ?? 0,
    vatRate: template?.vatRate ?? 0,
    discount: input.discount ?? 0,
    includeVat: template?.includeVat ?? true,
    includeTax: template?.includeTax ?? true,
    includeLineItemTax: template?.includeLineItemTax ?? false,
  });
  const digits = Math.log10(getCurrencyMultiplier(template?.currency ?? input.currency ?? "USD"));
  const formatter = new Intl.NumberFormat("en-US", {
    useGrouping: false,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  // Stabilize arithmetic at half-minor-unit boundaries (e.g. 1.25 × 19.99 plus VAT).
  const round = (value: number) =>
    Number(
      formatter.format(value + Math.sign(value) * Number.EPSILON * Math.max(1, Math.abs(value))),
    );
  return {
    subtotal: round(calculated.subTotal),
    amount: round(calculated.total),
    vat: round(calculated.vat),
    tax: round(calculated.tax),
  };
}
