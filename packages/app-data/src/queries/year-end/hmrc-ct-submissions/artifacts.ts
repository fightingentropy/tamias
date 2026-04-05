import { HmrcCtProvider, type HmrcCtEnvironment } from "@tamias/compliance";
import { createSubmissionArtifactBundle } from "../artifacts";
import { getHmrcCtRuntimeStatus } from "../runtime";
import type { FilingProfileRecord } from "@tamias/app-data-convex";
import type { Ct600Draft } from "../types";
import type { SubmissionArtifactBundleRecord } from "../types";

function resolveHmrcCtSubmissionReference(companyUtr?: string | null) {
  return (
    getHmrcCtRuntimeStatus({
      utr: companyUtr ?? null,
    }).submissionReference ?? "MISSING-UTR"
  );
}

export function buildCtSubmissionRequestSummary(args: {
  periodKey: string;
  profile: FilingProfileRecord;
  draft: Ct600Draft;
  provider: HmrcCtProvider;
  artifactBundle?: SubmissionArtifactBundleRecord | null;
}) {
  const providerConfig = args.provider.toConfig();
  return {
    periodKey: args.periodKey,
    environment: providerConfig.environment,
    submissionReference: resolveHmrcCtSubmissionReference(args.draft.utr),
    companyName: args.profile.companyName,
    companyNumber: args.profile.companyNumber,
    companyUtr: args.profile.utr,
    senderId: providerConfig.senderId,
    vendorId: providerConfig.vendorId,
    productName: providerConfig.productName,
    productVersion: providerConfig.productVersion,
    chargeableProfits: args.draft.chargeableProfits,
    taxPayable: args.draft.taxPayable,
    attachments: ["accounts", "computations"],
    supplementaryPages: args.draft.supplementaryPages.ct600a ? ["CT600A"] : [],
    artifactFiles: [
      "ct600-submission.xml",
      "accounts-attachment.ixbrl.xhtml",
      "computations-attachment.ixbrl.xhtml",
      "submission-request.json",
    ],
    artifactBundle: args.artifactBundle ?? null,
  };
}

export async function createCtSubmissionArtifactBundle(args: {
  teamId: string;
  periodKey: string;
  environment: HmrcCtEnvironment;
  submissionReference: string;
  requestSummary: Record<string, unknown>;
  ct600Xml: string;
  accountsAttachmentIxbrl: string;
  computationsAttachmentIxbrl: string;
}) {
  return createSubmissionArtifactBundle({
    teamId: args.teamId,
    scope: "corporation-tax",
    periodKey: args.periodKey,
    files: [
      {
        name: "ct600-submission.xml",
        data: Buffer.from(args.ct600Xml, "utf8"),
      },
      {
        name: "accounts-attachment.ixbrl.xhtml",
        data: Buffer.from(args.accountsAttachmentIxbrl, "utf8"),
      },
      {
        name: "computations-attachment.ixbrl.xhtml",
        data: Buffer.from(args.computationsAttachmentIxbrl, "utf8"),
      },
      {
        name: "submission-request.json",
        data: Buffer.from(JSON.stringify(args.requestSummary, null, 2), "utf8"),
      },
    ],
    manifest: {
      scope: "corporation-tax",
      periodKey: args.periodKey,
      environment: args.environment,
      submissionReference: args.submissionReference,
      files: [
        "ct600-submission.xml",
        "accounts-attachment.ixbrl.xhtml",
        "computations-attachment.ixbrl.xhtml",
        "submission-request.json",
      ],
    },
  });
}
