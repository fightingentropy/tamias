import { roundCurrency } from "@tamias/compliance";
import { SUPPORTED_SMALL_COMPANY_FILING_PATH } from "../constants";
import type { FilingReadiness } from "../types";

export function normalizeDirectorList(directors: string[] | null | undefined) {
  return (directors ?? [])
    .map((director) => director.trim())
    .filter((director) => director.length > 0);
}

export function groupCorporationTaxAdjustments(
  adjustments: Array<{
    category?: string | null;
    amount: number;
  }>,
) {
  const totals = {
    depreciationAmortisation: 0,
    charitableDonations: 0,
    capitalAllowances: 0,
    capitalAllowancesBalancingCharges: 0,
    lossesBroughtForward: 0,
    groupRelief: 0,
    other: 0,
  };

  for (const adjustment of adjustments) {
    switch (adjustment.category) {
      case "depreciation_amortisation":
        totals.depreciationAmortisation += adjustment.amount;
        break;
      case "charitable_donations":
        totals.charitableDonations += adjustment.amount;
        break;
      case "capital_allowances":
        totals.capitalAllowances += adjustment.amount;
        break;
      case "capital_allowances_balancing_charges":
        totals.capitalAllowancesBalancingCharges += adjustment.amount;
        break;
      case "losses_brought_forward":
        totals.lossesBroughtForward += adjustment.amount;
        break;
      case "group_relief":
        totals.groupRelief += adjustment.amount;
        break;
      default:
        totals.other += adjustment.amount;
        break;
    }
  }

  return {
    depreciationAmortisation: roundCurrency(totals.depreciationAmortisation),
    charitableDonations: roundCurrency(Math.abs(totals.charitableDonations)),
    capitalAllowances: roundCurrency(Math.abs(totals.capitalAllowances)),
    capitalAllowancesBalancingCharges: roundCurrency(
      totals.capitalAllowancesBalancingCharges,
    ),
    lossesBroughtForward: roundCurrency(Math.abs(totals.lossesBroughtForward)),
    groupRelief: roundCurrency(Math.abs(totals.groupRelief)),
    other: roundCurrency(totals.other),
  };
}

export function createFilingReadiness(
  blockers: string[],
  warnings: string[],
): FilingReadiness {
  return {
    supportedPath: SUPPORTED_SMALL_COMPANY_FILING_PATH,
    isReady: blockers.length === 0,
    blockers,
    warnings,
  };
}
