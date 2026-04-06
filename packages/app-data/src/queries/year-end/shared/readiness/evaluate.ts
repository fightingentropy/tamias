import { roundCurrency } from "@tamias/compliance";
import type {
  CloseCompanyLoansScheduleRecord,
  CorporationTaxRateScheduleRecord,
  FilingProfileRecord,
  YearEndPackRecord,
} from "@tamias/app-data-convex";
import { isAfter, isValid, parseISO } from "date-fns";
import type { CorporationTaxSummary } from "../types";
import { validateCloseCompanyLoansSchedule } from "./close-company-loans";
import { createFilingReadiness, normalizeDirectorList } from "./common";
import { buildCtComputationBreakdown } from "./computation";
import { validateCorporationTaxRateSchedule } from "./rate-schedule";

export function evaluateYearEndFilingReadiness(args: {
  profile: FilingProfileRecord;
  pack: YearEndPackRecord;
  closeCompanyLoansSchedule?: CloseCompanyLoansScheduleRecord | null;
  corporationTaxRateSchedule?: CorporationTaxRateScheduleRecord | null;
  shareCapitalFromLedger: number;
  balanceSheetEquity: number;
  totalEquity: number;
  netAssets: number;
  debtBalance: number;
  accountingProfitBeforeTax: number;
  corporationTax: CorporationTaxSummary | null;
}) {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const directors = normalizeDirectorList(args.profile.directors);

  if (args.pack.status === "draft") {
    blockers.push(
      "The underlying year-end pack is still in draft state. Rebuild and resolve the ledger imbalance first.",
    );
  }

  if (!args.profile.companyName) {
    blockers.push("Add the registered company name in the filing profile.");
  }

  if (!args.profile.companyNumber) {
    blockers.push(
      "Add the Companies House company number in the filing profile.",
    );
  }

  if (!args.profile.utr) {
    blockers.push("Add the corporation tax UTR in the filing profile.");
  }

  if (!args.profile.principalActivity?.trim()) {
    blockers.push("Add the principal activity for the directors' report.");
  }

  if (!directors.length) {
    blockers.push("Add at least one director name in the filing profile.");
  }

  if (!args.profile.signingDirectorName?.trim()) {
    blockers.push("Choose the director signing the financial statements.");
  } else if (!directors.includes(args.profile.signingDirectorName.trim())) {
    blockers.push(
      "The signing director must match one of the directors listed in the filing profile.",
    );
  }

  if (!args.profile.approvalDate) {
    blockers.push("Add the board approval date for the financial statements.");
  } else {
    const approvalDate = parseISO(args.profile.approvalDate);

    if (
      !isValid(approvalDate) ||
      isAfter(parseISO(args.pack.periodEnd), approvalDate)
    ) {
      blockers.push(
        "The approval date must be a valid date on or after the period end.",
      );
    }
  }

  if (args.profile.averageEmployeeCount == null) {
    blockers.push(
      "Add the average employee count for the statutory employee disclosure.",
    );
  }

  if (args.profile.dormant == null) {
    blockers.push("Confirm whether the company is dormant for this period.");
  }

  if (!args.profile.accountsPreparedUnderSmallCompaniesRegime) {
    blockers.push(
      "Confirm the accounts were prepared under the small companies regime.",
    );
  }

  if (!args.profile.auditExemptionClaimed) {
    blockers.push(
      "Confirm the section 477 small-company audit exemption statement.",
    );
  }

  if (!args.profile.membersDidNotRequireAudit) {
    blockers.push(
      "Confirm the members did not require the company to obtain an audit.",
    );
  }

  if (!args.profile.directorsAcknowledgeResponsibilities) {
    blockers.push(
      "Confirm the directors' Companies Act responsibility statement.",
    );
  }

  if (
    args.profile.ordinaryShareCount == null ||
    args.profile.ordinaryShareCount <= 0
  ) {
    blockers.push("Add the number of ordinary shares in issue.");
  }

  if (
    args.profile.ordinaryShareNominalValue == null ||
    args.profile.ordinaryShareNominalValue <= 0
  ) {
    blockers.push("Add the nominal value per ordinary share.");
  }

  if (
    args.profile.ordinaryShareCount != null &&
    args.profile.ordinaryShareNominalValue != null
  ) {
    const expectedShareCapital = roundCurrency(
      args.profile.ordinaryShareCount * args.profile.ordinaryShareNominalValue,
    );

    if (Math.abs(expectedShareCapital - args.shareCapitalFromLedger) > 0.009) {
      blockers.push(
        "Ordinary share count and nominal value do not tie to the ledger share-capital balance.",
      );
    }
  }

  if (Math.abs(args.balanceSheetEquity - args.totalEquity) > 0.009) {
    blockers.push(
      "Additional equity reserves are present outside ordinary share capital and retained earnings. That reserve structure is not yet supported by the filing-ready small-company path.",
    );
  }

  if (
    args.profile.dormant &&
    (Math.abs(args.netAssets) > 0.009 ||
      Math.abs(args.accountingProfitBeforeTax) > 0.009 ||
      Math.abs(args.corporationTax?.estimatedCorporationTaxDue ?? 0) > 0.009)
  ) {
    blockers.push(
      "The filing profile marks the company as dormant, but the current year-end pack shows trading activity or balances.",
    );
  }

  if (Math.abs(args.debtBalance) > 0.009) {
    blockers.push(
      "Debt balances still need maturity splitting and note support before the pack can be treated as filing-ready.",
    );
  }

  if (Math.abs(args.netAssets - args.totalEquity) > 0.009) {
    blockers.push(
      "Net assets do not tie back to capital and reserves. Review the equity mapping before filing.",
    );
  }

  const computation = buildCtComputationBreakdown({
    accountingProfitBeforeTax: args.accountingProfitBeforeTax,
    adjustments: args.corporationTax?.adjustments ?? [],
  });

  if (Math.abs(computation.groupedAdjustments.other) > 0.009) {
    blockers.push(
      "At least one corporation-tax adjustment is still in the unsupported 'other' category. Reclassify it to use the filing-ready CT computation path.",
    );
  }

  for (const adjustment of args.corporationTax?.adjustments ?? []) {
    switch (adjustment.category) {
      case "depreciation_amortisation":
      case "capital_allowances_balancing_charges":
        if (adjustment.amount < 0) {
          blockers.push(
            `${adjustment.label} is using a negative amount, but its category must increase taxable profits.`,
          );
        }
        break;
      case "charitable_donations":
      case "capital_allowances":
      case "losses_brought_forward":
      case "group_relief":
        if (adjustment.amount > 0) {
          blockers.push(
            `${adjustment.label} is using a positive amount, but its category must reduce taxable profits.`,
          );
        }
        break;
      default:
        break;
    }
  }

  const expectedTaxableProfit =
    computation.breakdown.totalProfitsChargeableToCorporationTax;
  const recordedTaxableProfit = roundCurrency(
    args.corporationTax?.taxableProfit ?? expectedTaxableProfit,
  );

  if (expectedTaxableProfit < -0.009) {
    blockers.push(
      "The structured CT computation produces negative chargeable profits. Loss-making filings remain outside the supported filing-ready path.",
    );
  }

  if (Math.abs(expectedTaxableProfit - recordedTaxableProfit) > 0.009) {
    blockers.push(
      "The structured CT computation does not tie to the taxable-profit total in the year-end pack.",
    );
  }

  if (
    args.corporationTax &&
    Math.abs(
      args.corporationTax.accountingProfitBeforeTax -
        args.accountingProfitBeforeTax,
    ) > 0.009
  ) {
    warnings.push(
      "The CT summary uses an accounting-profit figure that no longer matches the profit and loss schedule. Rebuild the pack before submitting.",
    );
  }

  const closeCompanyLoansEvaluation = validateCloseCompanyLoansSchedule({
    schedule: args.closeCompanyLoansSchedule,
    periodEnd: args.pack.periodEnd,
  });
  const corporationTaxRateEvaluation = validateCorporationTaxRateSchedule({
    schedule: args.corporationTaxRateSchedule,
    periodStart: args.pack.periodStart,
    periodEnd: args.pack.periodEnd,
  });

  blockers.push(...closeCompanyLoansEvaluation.blockers);
  warnings.push(...closeCompanyLoansEvaluation.warnings);
  blockers.push(...corporationTaxRateEvaluation.blockers);
  warnings.push(...corporationTaxRateEvaluation.warnings);

  return {
    directors,
    computationBreakdown: computation.breakdown,
    filingReadiness: createFilingReadiness(blockers, warnings),
  };
}
