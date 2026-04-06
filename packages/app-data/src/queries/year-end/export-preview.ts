import { CompaniesHouseXmlGatewayProvider } from "@tamias/compliance";
import type { FilingProfileRecord, YearEndPackRecord } from "@tamias/app-data-convex";
import { buildCompaniesHousePreviewSubmissionIdentifiers } from "./companies-house-submissions";
import type { CtSubmissionArtifacts } from "./types";

export function buildCompaniesHouseExportPreviewSubmissionXml(args: {
  profile: FilingProfileRecord;
  pack: YearEndPackRecord;
  submissionArtifacts: CtSubmissionArtifacts;
}) {
  const provider = (() => {
    try {
      return CompaniesHouseXmlGatewayProvider.fromEnvironment();
    } catch {
      return null;
    }
  })();
  const approvalDate = args.submissionArtifacts.statutoryAccountsDraft.approvalDate;
  const companyNumber = args.submissionArtifacts.statutoryAccountsDraft.companyNumber;

  if (!provider || !approvalDate || !companyNumber) {
    return null;
  }

  const identifiers = buildCompaniesHousePreviewSubmissionIdentifiers(args.pack.periodKey);

  return provider.buildAccountsSubmissionXml({
    companyName: args.submissionArtifacts.statutoryAccountsDraft.companyName,
    companyNumber,
    companyAuthenticationCode: args.profile.companyAuthenticationCode,
    dateSigned: approvalDate,
    accountsIxbrl: args.submissionArtifacts.accountsAttachmentIxbrl,
    submissionNumber: identifiers.submissionNumber,
    transactionId: identifiers.transactionId,
    customerReference: `YE${args.pack.periodKey.replaceAll("-", "")}`,
  });
}
