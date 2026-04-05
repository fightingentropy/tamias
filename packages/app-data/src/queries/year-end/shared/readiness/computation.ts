import { roundCurrency } from "@tamias/compliance";
import type { CtComputationBreakdown } from "../types";
import { groupCorporationTaxAdjustments } from "./common";

export function buildCtComputationBreakdown(args: {
  accountingProfitBeforeTax: number;
  adjustments: Array<{
    category?: string | null;
    amount: number;
  }>;
}) {
  const groupedAdjustments = groupCorporationTaxAdjustments(args.adjustments);
  const breakdown: CtComputationBreakdown = {
    profitLossPerAccounts: roundCurrency(args.accountingProfitBeforeTax),
    depreciationAmortisationAdjustments:
      groupedAdjustments.depreciationAmortisation,
    capitalAllowancesBalancingCharges:
      groupedAdjustments.capitalAllowancesBalancingCharges,
    netTradingProfits: roundCurrency(
      args.accountingProfitBeforeTax +
        groupedAdjustments.depreciationAmortisation +
        groupedAdjustments.capitalAllowancesBalancingCharges -
        groupedAdjustments.capitalAllowances,
    ),
    totalCapitalAllowances: groupedAdjustments.capitalAllowances,
    profitsBeforeChargesAndGroupRelief: 0,
    qualifyingDonations: groupedAdjustments.charitableDonations,
    lossesBroughtForward: groupedAdjustments.lossesBroughtForward,
    groupReliefClaimed: groupedAdjustments.groupRelief,
    totalProfitsChargeableToCorporationTax: 0,
  };

  breakdown.profitsBeforeChargesAndGroupRelief = breakdown.netTradingProfits;
  breakdown.totalProfitsChargeableToCorporationTax = roundCurrency(
    breakdown.profitsBeforeChargesAndGroupRelief -
      breakdown.qualifyingDonations -
      breakdown.lossesBroughtForward -
      breakdown.groupReliefClaimed,
  );

  return {
    groupedAdjustments,
    breakdown,
  };
}
