import { roundCurrency } from "@tamias/compliance";
import type {
  CloseCompanyLoansScheduleRecord,
  CorporationTaxRateScheduleRecord,
  FilingProfileRecord,
  YearEndPackRecord,
} from "@tamias/app-data-convex";
import { SUPPORTED_SMALL_COMPANY_FILING_PATH } from "./constants";
import { buildYearEndDraftEvaluation } from "./drafts-support";
import {
  buildCorporationTaxRateSummary,
  buildCt600aSupplement,
  getCorporationTaxFinancialYear,
} from "./tax";
import type { Ct600Draft, TeamContext } from "./types";

export function buildCt600Draft(args: {
  team: TeamContext;
  profile: FilingProfileRecord;
  pack: YearEndPackRecord;
  closeCompanyLoansSchedule?: CloseCompanyLoansScheduleRecord | null;
  corporationTaxRateSchedule?: CorporationTaxRateScheduleRecord | null;
  generatedAt?: string;
}): Ct600Draft {
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const derived = buildYearEndDraftEvaluation(args);
  const turnover = Math.max(
    derived.profitAndLoss.find((line) => line.key === "revenue")?.amount ?? 0,
    0,
  );
  const chargeableProfits = roundCurrency(
    Math.max(derived.evaluation.computationBreakdown.totalProfitsChargeableToCorporationTax, 0),
  );
  const rateSummary = buildCorporationTaxRateSummary({
    periodStart: args.pack.periodStart,
    periodEnd: args.pack.periodEnd,
    chargeableProfits,
    rateSchedule: args.corporationTaxRateSchedule,
  });
  const taxRate = roundCurrency(rateSummary.effectiveTaxRate * 100) / 100;
  const grossCorporationTax = rateSummary.grossCorporationTaxDue;
  const marginalRelief = rateSummary.marginalRelief;
  const netCorporationTaxChargeable = rateSummary.netCorporationTaxDue;
  const ct600aSupplement = buildCt600aSupplement(args.closeCompanyLoansSchedule);
  const loansToParticipatorsTax = ct600aSupplement?.taxPayable ?? 0;
  const totalTaxPayable = roundCurrency(netCorporationTaxChargeable + loansToParticipatorsTax);
  const reviewItems = [
    "The draft XML includes an HMRC-style GovTalk envelope, a computed IRmark, and structured iXBRL attachments for the supported small-company path.",
    ct600aSupplement
      ? "CT600A is included from the close-company loans schedule saved against this year-end period."
      : "No CT600 supplementary page is included for this period unless a close-company loans schedule is saved.",
    ...derived.evaluation.filingReadiness.warnings,
  ];

  if (!args.profile.utr) {
    reviewItems.push(
      "Add the company UTR in the filing profile before using this CT600 draft externally.",
    );
  }

  if (!derived.evaluation.filingReadiness.isReady) {
    reviewItems.push(...derived.evaluation.filingReadiness.blockers);
  }

  return {
    generatedAt,
    companyName: args.profile.companyName ?? args.team.name ?? "Unnamed company",
    companyNumber: args.profile.companyNumber,
    utr: args.profile.utr,
    periodStart: args.pack.periodStart,
    periodEnd: args.pack.periodEnd,
    accountsDueDate: args.pack.accountsDueDate,
    currency: args.pack.currency,
    companyType: 0,
    turnover,
    tradingProfits: derived.evaluation.computationBreakdown.netTradingProfits,
    lossesBroughtForward: derived.evaluation.computationBreakdown.lossesBroughtForward,
    netProfits: roundCurrency(
      derived.evaluation.computationBreakdown.netTradingProfits -
        derived.evaluation.computationBreakdown.lossesBroughtForward,
    ),
    profitsBeforeOtherDeductions: roundCurrency(
      derived.evaluation.computationBreakdown.netTradingProfits -
        derived.evaluation.computationBreakdown.lossesBroughtForward,
    ),
    profitsBeforeDonationsAndGroupRelief:
      derived.evaluation.computationBreakdown.profitsBeforeChargesAndGroupRelief,
    chargeableProfits,
    corporationTax: grossCorporationTax,
    netCorporationTaxChargeable,
    netCorporationTaxLiability: totalTaxPayable,
    taxChargeable: totalTaxPayable,
    taxPayable: totalTaxPayable,
    loansToParticipatorsTax,
    ct600AReliefDue: (ct600aSupplement?.loanLaterReliefNow?.reliefDue ?? 0) > 0,
    taxRate,
    financialYear:
      rateSummary.financialYears[0]?.financialYear ??
      getCorporationTaxFinancialYear(args.pack.periodStart),
    grossCorporationTax,
    marginalRelief,
    exemptDistributions: rateSummary.exemptDistributions,
    augmentedProfits: rateSummary.augmentedProfits,
    startingOrSmallCompaniesRate: rateSummary.startingOrSmallCompaniesRate,
    associatedCompaniesMode: rateSummary.associatedCompaniesMode,
    associatedCompaniesThisPeriod: rateSummary.associatedCompaniesThisPeriod,
    associatedCompaniesFirstYear: rateSummary.associatedCompaniesFirstYear,
    associatedCompaniesSecondYear: rateSummary.associatedCompaniesSecondYear,
    financialYearBreakdown: rateSummary.financialYears,
    declarationName: args.profile.companyName ?? args.team.name ?? "Director",
    declarationStatus: "Director",
    returnType: "new",
    computationBreakdown: derived.evaluation.computationBreakdown,
    supplementaryPages: {
      ct600a: ct600aSupplement,
    },
    reviewItems,
    limitations: derived.evaluation.filingReadiness.isReady
      ? [
          `This draft is filing-ready for the supported path: ${SUPPORTED_SMALL_COMPANY_FILING_PATH}.`,
          "CT600A and HMRC marginal relief are supported. Other supplementary CT schedules and regimes outside the supported small-company path remain out of scope.",
        ]
      : [
          "This XML is submission-shaped to HMRC's published CT600 samples but should not be submitted until every filing-readiness blocker is cleared.",
          "CT600A and HMRC marginal relief are supported. Other supplementary CT schedules and regimes outside the supported small-company path remain out of scope.",
        ],
    filingReadiness: derived.evaluation.filingReadiness,
  };
}
