import { HmrcCtProvider } from "@tamias/compliance";
import {
  createSubmissionEventInConvex,
  getCloseCompanyLoansScheduleByPeriodFromConvex,
  getCorporationTaxRateScheduleByPeriodFromConvex,
  getYearEndPackByPeriodFromConvex,
  type FilingProfileRecord,
} from "@tamias/app-data-convex";
import type { Database } from "../../../client";
import { buildCtSubmissionArtifacts } from "../drafts";
import { getYearEndContext } from "../pack";
import { getHmrcCtRuntimeStatus } from "../runtime";
import {
  getSubmissionEventResponseEndpoint,
  requireReadyYearEndPack,
} from "../submission-common";
import { createCtSubmissionArtifactBundle, buildCtSubmissionRequestSummary } from "./artifacts";
import type { SubmissionArtifactBundleRecord } from "../types";

function resolveCtSubmissionStatus(message: {
  status?: "submitted" | "accepted" | "rejected";
  qualifier: string | null;
}) {
  if (message.status) {
    return message.status;
  }

  switch (message.qualifier) {
    case "response":
      return "accepted";
    case "error":
      return "rejected";
    default:
      return "submitted";
  }
}

function assertHmrcCtSubmissionReferenceReady(
  provider: HmrcCtProvider,
  profile: FilingProfileRecord,
) {
  const runtimeStatus = getHmrcCtRuntimeStatus(profile);

  if (runtimeStatus.submissionReference) {
    return runtimeStatus;
  }

  if (provider.environment === "production") {
    throw new Error(
      "Add the company UTR in compliance settings before switching HMRC CT filing to production.",
    );
  }

  throw new Error(
    "Set HMRC_CT_TEST_UTR on the API runtime or add the company UTR in compliance settings before CT submission.",
  );
}

export async function submitCt600ToHmrc(
  db: Database,
  params: {
    teamId: string;
    submittedBy: string;
    periodKey?: string;
    declarationAccepted: true;
  },
) {
  const context = await getYearEndContext(db, params.teamId, params.periodKey);
  const [packRecord, closeCompanyLoansSchedule, corporationTaxRateSchedule] =
    await Promise.all([
      getYearEndPackByPeriodFromConvex({
        teamId: params.teamId,
        filingProfileId: context.profile.id,
        periodKey: context.period.periodKey,
      }),
      getCloseCompanyLoansScheduleByPeriodFromConvex({
        teamId: params.teamId,
        filingProfileId: context.profile.id,
        periodKey: context.period.periodKey,
      }),
      getCorporationTaxRateScheduleByPeriodFromConvex({
        teamId: params.teamId,
        filingProfileId: context.profile.id,
        periodKey: context.period.periodKey,
      }),
    ]);
  const pack = requireReadyYearEndPack(packRecord);
  const artifacts = buildCtSubmissionArtifacts({
    team: context.team,
    profile: context.profile,
    pack,
    closeCompanyLoansSchedule,
    corporationTaxRateSchedule,
  });

  if (!params.declarationAccepted) {
    throw new Error("Declaration must be accepted before CT submission");
  }

  if (!artifacts.ct600Draft.filingReadiness.isReady) {
    throw new Error(
      [
        "CT600 submission is blocked until the supported filing-ready path is complete.",
        ...artifacts.ct600Draft.filingReadiness.blockers,
      ].join(" "),
    );
  }

  let provider: HmrcCtProvider;

  try {
    provider = HmrcCtProvider.fromEnvironment();
  } catch (error) {
    await createSubmissionEventInConvex({
      teamId: params.teamId,
      filingProfileId: context.profile.id,
      provider: "hmrc-ct",
      obligationType: "corporation_tax",
      status: "failed",
      eventType: "return_submission_failed",
      requestPayload: {
        periodKey: context.period.periodKey,
      },
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  assertHmrcCtSubmissionReferenceReady(provider, context.profile);

  const requestSummaryBase = buildCtSubmissionRequestSummary({
    periodKey: context.period.periodKey,
    profile: context.profile,
    draft: artifacts.ct600Draft,
    provider,
  });
  let artifactBundle: SubmissionArtifactBundleRecord;

  try {
    artifactBundle = await createCtSubmissionArtifactBundle({
      teamId: params.teamId,
      periodKey: context.period.periodKey,
      environment: provider.environment,
      submissionReference: String(requestSummaryBase.submissionReference),
      requestSummary: requestSummaryBase,
      ct600Xml: artifacts.ct600DraftXml,
      accountsAttachmentIxbrl: artifacts.accountsAttachmentIxbrl,
      computationsAttachmentIxbrl: artifacts.computationsAttachmentIxbrl,
    });
  } catch (error) {
    await createSubmissionEventInConvex({
      teamId: params.teamId,
      filingProfileId: context.profile.id,
      provider: "hmrc-ct",
      obligationType: "corporation_tax",
      status: "failed",
      eventType: "return_submission_failed",
      requestPayload: requestSummaryBase,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  const requestSummary = buildCtSubmissionRequestSummary({
    periodKey: context.period.periodKey,
    profile: context.profile,
    draft: artifacts.ct600Draft,
    provider,
    artifactBundle,
  });

  try {
    const receipt = await provider.submitSubmissionXml(artifacts.ct600DraftXml);

    await createSubmissionEventInConvex({
      teamId: params.teamId,
      filingProfileId: context.profile.id,
      provider: "hmrc-ct",
      obligationType: "corporation_tax",
      status: resolveCtSubmissionStatus(receipt),
      eventType: "return_submitted",
      correlationId: receipt.correlationId,
      requestPayload: requestSummary,
      responsePayload: receipt as unknown as Record<string, unknown>,
    });

    return {
      receipt,
      request: requestSummary,
    };
  } catch (error) {
    await createSubmissionEventInConvex({
      teamId: params.teamId,
      filingProfileId: context.profile.id,
      provider: "hmrc-ct",
      obligationType: "corporation_tax",
      status: "failed",
      eventType: "return_submission_failed",
      requestPayload: requestSummary,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
