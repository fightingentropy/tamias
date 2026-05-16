"use client";

import dynamic from "@/framework/dynamic";
import { useTaxReturnParams } from "@/hooks/use-tax-return-params";
import { useDeferredSheetMount } from "./global-sheet-mount";

const TaxReturnReviewSheet = dynamic(
  () =>
    import("@/components/sheets/tax-return-review-sheet").then((mod) => mod.TaxReturnReviewSheet),
  { ssr: false },
);

function TaxReturnReviewSheetMount() {
  const { taxReturn } = useTaxReturnParams();
  const shouldMount = useDeferredSheetMount(Boolean(taxReturn));

  return shouldMount ? <TaxReturnReviewSheet /> : null;
}

export function GlobalComplianceSheets() {
  return <TaxReturnReviewSheetMount />;
}
