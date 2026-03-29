import { describe, expect, test } from "bun:test";
import { buildVatBoxValues } from "@tamias/compliance";

describe("UK VAT draft boxes", () => {
  test("calculates box totals and rounding rules", () => {
    const result = buildVatBoxValues({
      outputVat: 125.4,
      reclaimedVat: 25.4,
      salesExVat: 602.2,
      purchasesExVat: 102.7,
      adjustments: {
        box1: 4.6,
        box7: 0.4,
      },
    });

    expect(result.box1).toBe(130);
    expect(result.box3).toBe(130);
    expect(result.box4).toBe(25.4);
    expect(result.box5).toBe(104.6);
    expect(result.box6).toBe(602);
    expect(result.box7).toBe(103);
  });
});
