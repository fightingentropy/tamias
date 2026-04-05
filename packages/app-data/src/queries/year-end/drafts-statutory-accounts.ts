import { SUPPORTED_SMALL_COMPANY_FILING_PATH } from "./constants";
import { buildYearEndDraftEvaluation } from "./drafts-support";
import type {
  CloseCompanyLoansScheduleRecord,
  CorporationTaxRateScheduleRecord,
  FilingProfileRecord,
  YearEndPackRecord,
} from "../../convex";
import type { StatutoryAccountsDraft, TeamContext } from "./types";

export function buildStatutoryAccountsDraft(args: {
  team: TeamContext;
  profile: FilingProfileRecord;
  pack: YearEndPackRecord;
  closeCompanyLoansSchedule?: CloseCompanyLoansScheduleRecord | null;
  corporationTaxRateSchedule?: CorporationTaxRateScheduleRecord | null;
  generatedAt?: string;
}): StatutoryAccountsDraft {
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const derived = buildYearEndDraftEvaluation(args);
  const reviewItems = [
    "The standalone draft HTML is for review only. Use the generated iXBRL attachment for CT submission workflows.",
    ...derived.evaluation.filingReadiness.warnings,
  ];

  if (!derived.evaluation.filingReadiness.isReady) {
    reviewItems.push(...derived.evaluation.filingReadiness.blockers);
  }

  return {
    generatedAt,
    companyName:
      args.profile.companyName ?? args.team.name ?? "Unnamed company",
    companyNumber: args.profile.companyNumber,
    periodStart: args.pack.periodStart,
    periodEnd: args.pack.periodEnd,
    accountsDueDate: args.pack.accountsDueDate,
    currency: args.pack.currency,
    accountingBasis: args.profile.accountingBasis,
    principalActivity: args.profile.principalActivity,
    directors: derived.evaluation.directors,
    signingDirectorName: args.profile.signingDirectorName,
    approvalDate: args.profile.approvalDate,
    averageEmployeeCount: args.profile.averageEmployeeCount,
    ordinaryShareCount: args.profile.ordinaryShareCount,
    ordinaryShareNominalValue: args.profile.ordinaryShareNominalValue,
    dormant: args.profile.dormant,
    auditExemptionClaimed: args.profile.auditExemptionClaimed,
    membersDidNotRequireAudit: args.profile.membersDidNotRequireAudit,
    directorsAcknowledgeResponsibilities:
      args.profile.directorsAcknowledgeResponsibilities,
    accountsPreparedUnderSmallCompaniesRegime:
      args.profile.accountsPreparedUnderSmallCompaniesRegime,
    statementOfFinancialPosition: {
      assets: derived.assets,
      liabilities: derived.liabilities,
      netAssets: derived.netAssets,
      shareCapital: derived.shareCapital,
      retainedEarnings: derived.retainedReserve,
      otherReserves: derived.otherReserves,
      totalEquity: derived.totalEquity,
    },
    profitAndLoss: derived.profitAndLoss,
    balanceSheet: derived.balanceSheet,
    retainedEarnings: derived.retainedEarnings,
    corporationTax: derived.corporationTax,
    workingPaperNotes: derived.workingPapers
      .filter((section) => section.lines.length > 0)
      .map((section) => ({
        key: section.key,
        label: section.label,
        total: section.total,
        lines: section.lines.map((line) => ({
          label: `${line.accountName} (${line.accountCode})`,
          amount: line.balance,
        })),
      })),
    reviewItems,
    limitations: derived.evaluation.filingReadiness.isReady
      ? [
          `This pack is filing-ready for the supported path: ${SUPPORTED_SMALL_COMPANY_FILING_PATH}.`,
          "CT600A and HMRC marginal relief are supported. Other supplementary pages, complex tax reliefs, and non-small-company reporting regimes remain outside the supported path.",
        ]
      : [
          "This draft is assembled from the Tamias year-end pack and explicit filing-profile facts.",
          "Until every blocker is cleared, treat the attachment as a non-filing-ready draft.",
          "CT600A and HMRC marginal relief are supported. Other supplementary pages, complex tax reliefs, and non-small-company reporting regimes remain outside the supported path.",
        ],
    filingReadiness: derived.evaluation.filingReadiness,
  };
}
