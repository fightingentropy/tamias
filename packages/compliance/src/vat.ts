import type { VatReturnDraftLine } from "./types";

export type VatBoxValues = Record<
  "box1" | "box2" | "box3" | "box4" | "box5" | "box6" | "box7" | "box8" | "box9",
  number
>;

export function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

export function roundHmrcInteger(value: number): number {
  return Math.round(value);
}

export function buildVatBoxValues(input: {
  outputVat: number;
  acquisitionVat?: number;
  reclaimedVat: number;
  salesExVat: number;
  purchasesExVat: number;
  goodsSuppliedExVat?: number;
  acquisitionsExVat?: number;
  adjustments?: Partial<VatBoxValues>;
}): VatBoxValues {
  const outputVat = roundCurrency(input.outputVat);
  const acquisitionVat = roundCurrency(input.acquisitionVat ?? 0);
  const reclaimedVat = roundCurrency(input.reclaimedVat);

  const adjustments = input.adjustments ?? {};

  const box1 = roundCurrency(outputVat + (adjustments.box1 ?? 0));
  const box2 = roundCurrency(acquisitionVat + (adjustments.box2 ?? 0));
  const box3 = roundCurrency(box1 + box2 + (adjustments.box3 ?? 0));
  const box4 = roundCurrency(reclaimedVat + (adjustments.box4 ?? 0));
  const box5 = roundCurrency(box3 - box4 + (adjustments.box5 ?? 0));
  const box6 = roundHmrcInteger(input.salesExVat + (adjustments.box6 ?? 0));
  const box7 = roundHmrcInteger(input.purchasesExVat + (adjustments.box7 ?? 0));
  const box8 = roundHmrcInteger((input.goodsSuppliedExVat ?? 0) + (adjustments.box8 ?? 0));
  const box9 = roundHmrcInteger((input.acquisitionsExVat ?? 0) + (adjustments.box9 ?? 0));

  return { box1, box2, box3, box4, box5, box6, box7, box8, box9 };
}

export function buildVatDraftLines(boxes: VatBoxValues): VatReturnDraftLine[] {
  return [
    { code: "box1", amount: boxes.box1, label: "VAT due on sales" },
    { code: "box2", amount: boxes.box2, label: "VAT due on acquisitions" },
    { code: "box3", amount: boxes.box3, label: "Total VAT due" },
    { code: "box4", amount: boxes.box4, label: "VAT reclaimed" },
    { code: "box5", amount: boxes.box5, label: "Net VAT due" },
    { code: "box6", amount: boxes.box6, label: "Sales excluding VAT" },
    { code: "box7", amount: boxes.box7, label: "Purchases excluding VAT" },
    { code: "box8", amount: boxes.box8, label: "Goods supplied to EU" },
    { code: "box9", amount: boxes.box9, label: "Acquisitions from EU" },
  ];
}
