import { useQueryStates } from "nuqs";
import { createLoader, parseAsStringEnum } from "nuqs/server";

export const taxReturnTypes = ["ct600", "vat"] as const;
export type TaxReturnType = (typeof taxReturnTypes)[number];

const taxReturnParamsSchema = {
  taxReturn: parseAsStringEnum(taxReturnTypes),
};

export function useTaxReturnParams() {
  const [params, setParams] = useQueryStates(taxReturnParamsSchema);

  return {
    ...params,
    setParams,
  };
}

export function getTaxReturnReviewPath(type: TaxReturnType) {
  return type === "ct600" ? "/compliance/year-end" : "/compliance/vat";
}

export function openTaxReturnReviewWindow(type: TaxReturnType) {
  if (typeof window === "undefined") {
    return;
  }

  const url = new URL(window.location.href);
  url.pathname = getTaxReturnReviewPath(type);
  url.searchParams.set("taxReturn", type);

  window.open(url.toString(), "_blank", "noopener,noreferrer,width=1120,height=900");
}

export const loadTaxReturnParams = createLoader(taxReturnParamsSchema);
