import type { CompaniesHouseGatewayMessage } from "@tamias/compliance";
import type { FilingProfileRecord } from "@tamias/app-data-convex";
import type { StatutoryAccountsDraft } from "../types";

export function findCompaniesHouseSubmissionStatus(
  message: CompaniesHouseGatewayMessage,
  submissionNumber?: string | null,
) {
  if (!submissionNumber) {
    return message.statuses[0] ?? null;
  }

  return (
    message.statuses.find((status) => status.submissionNumber === submissionNumber) ??
    message.statuses[0] ??
    null
  );
}

export function resolveCompaniesHouseAccountsSubmissionStatus(
  message: CompaniesHouseGatewayMessage,
  submissionNumber?: string | null,
) {
  const status = findCompaniesHouseSubmissionStatus(message, submissionNumber);

  switch (status?.statusCode) {
    case "ACCEPT":
      return "accepted";
    case "REJECT":
    case "INTERNAL_FAILURE":
      return "rejected";
    case "PENDING":
    case "PARKED":
      return "submitted";
    default:
      return message.qualifier === "error" ? "rejected" : "submitted";
  }
}

export function buildCompaniesHouseAccountsSubmissionRequestSummary(args: {
  periodKey: string;
  profile: FilingProfileRecord;
  draft: StatutoryAccountsDraft;
  provider: { environment: string; presenterId: string; packageReference: string };
  submissionNumber: string;
  transactionId: string;
}) {
  return {
    periodKey: args.periodKey,
    environment: args.provider.environment,
    companyName: args.profile.companyName,
    companyNumber: args.profile.companyNumber,
    companyAuthenticationCodeConfigured: Boolean(args.profile.companyAuthenticationCode),
    presenterId: args.provider.presenterId,
    packageReference: args.provider.packageReference,
    submissionNumber: args.submissionNumber,
    transactionId: args.transactionId,
    customerReference: `YE${args.periodKey.replaceAll("-", "")}`,
    accountsDueDate: args.draft.accountsDueDate,
    approvalDate: args.draft.approvalDate,
    filingReadiness: args.draft.filingReadiness,
  };
}
