import { CompaniesHouseXmlGatewayProvider } from "@tamias/compliance";
import {
  createSubmissionEventInConvex,
  getCloseCompanyLoansScheduleByPeriodFromConvex,
  getCorporationTaxRateScheduleByPeriodFromConvex,
  getYearEndPackByPeriodFromConvex,
} from "../../../convex";
import type { Database } from "../../../client";
import { buildCtSubmissionArtifacts } from "../drafts";
import { getYearEndContext } from "../pack";
import {
  getSubmissionEventRequestSubmissionNumber,
  listYearEndSubmissionEvents,
  requireReadyYearEndPack,
} from "../submission-common";
import {
  allocateCompaniesHouseSubmissionIdentifiers,
} from "./identifiers";
import {
  buildCompaniesHouseAccountsSubmissionRequestSummary,
  findCompaniesHouseSubmissionStatus,
  resolveCompaniesHouseAccountsSubmissionStatus,
} from "./status";

export async function listAccountsSubmissionEvents(
  db: Database,
  params: { teamId: string; periodKey?: string },
) {
  void db;

  return listYearEndSubmissionEvents({
    teamId: params.teamId,
    provider: "companies-house",
    obligationType: "accounts",
    periodKey: params.periodKey,
  });
}

export async function submitAnnualAccountsToCompaniesHouse(
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
  const submissionArtifacts = buildCtSubmissionArtifacts({
    team: context.team,
    profile: context.profile,
    pack,
    closeCompanyLoansSchedule,
    corporationTaxRateSchedule,
  });
  const companyAuthenticationCode =
    context.profile.companyAuthenticationCode?.trim().toUpperCase() ?? null;

  if (!params.declarationAccepted) {
    throw new Error(
      "Declaration must be accepted before Companies House accounts submission",
    );
  }

  if (!submissionArtifacts.statutoryAccountsDraft.filingReadiness.isReady) {
    throw new Error(
      [
        "Annual accounts submission is blocked until the supported filing-ready path is complete.",
        ...submissionArtifacts.statutoryAccountsDraft.filingReadiness.blockers,
      ].join(" "),
    );
  }

  if (!companyAuthenticationCode) {
    throw new Error(
      "Add the Companies House authentication code in compliance settings before annual accounts submission",
    );
  }

  let provider: CompaniesHouseXmlGatewayProvider;

  try {
    provider = CompaniesHouseXmlGatewayProvider.fromEnvironment();
  } catch (error) {
    await createSubmissionEventInConvex({
      teamId: params.teamId,
      filingProfileId: context.profile.id,
      provider: "companies-house",
      obligationType: "accounts",
      status: "failed",
      eventType: "annual_accounts_submission_failed",
      requestPayload: {
        periodKey: context.period.periodKey,
      },
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  let identifiers: Awaited<
    ReturnType<typeof allocateCompaniesHouseSubmissionIdentifiers>
  > | null = null;
  let requestSummary:
    | (ReturnType<
        typeof buildCompaniesHouseAccountsSubmissionRequestSummary
      > & {
        submittedBy: string;
      })
    | null = null;

  try {
    identifiers = await allocateCompaniesHouseSubmissionIdentifiers(provider);
    requestSummary = {
      ...buildCompaniesHouseAccountsSubmissionRequestSummary({
        periodKey: context.period.periodKey,
        profile: context.profile,
        draft: submissionArtifacts.statutoryAccountsDraft,
        provider,
        submissionNumber: identifiers.submissionNumber,
        transactionId: identifiers.transactionId,
      }),
      submittedBy: params.submittedBy,
    };
    const submissionXml = provider.buildAccountsSubmissionXml({
      companyName: submissionArtifacts.statutoryAccountsDraft.companyName,
      companyNumber:
        context.profile.companyNumber ??
        submissionArtifacts.statutoryAccountsDraft.companyNumber ??
        "",
      companyAuthenticationCode,
      dateSigned:
        submissionArtifacts.statutoryAccountsDraft.approvalDate ??
        context.period.periodEnd,
      accountsIxbrl: submissionArtifacts.accountsAttachmentIxbrl,
      submissionNumber: identifiers.submissionNumber,
      transactionId: identifiers.transactionId,
      customerReference: requestSummary.customerReference,
    });
    const receipt = await provider.submitAccountsXml(submissionXml);
    const selectedStatus = findCompaniesHouseSubmissionStatus(
      receipt,
      identifiers.submissionNumber,
    );

    await createSubmissionEventInConvex({
      teamId: params.teamId,
      filingProfileId: context.profile.id,
      provider: "companies-house",
      obligationType: "accounts",
      status: resolveCompaniesHouseAccountsSubmissionStatus(
        receipt,
        identifiers.submissionNumber,
      ),
      eventType: "annual_accounts_submitted",
      correlationId: identifiers.submissionNumber,
      requestPayload: requestSummary,
      responsePayload: {
        ...receipt,
        selectedStatus,
      } as unknown as Record<string, unknown>,
    });

    return {
      receipt,
      request: requestSummary,
      submissionXml,
    };
  } catch (error) {
    await createSubmissionEventInConvex({
      teamId: params.teamId,
      filingProfileId: context.profile.id,
      provider: "companies-house",
      obligationType: "accounts",
      status: "failed",
      eventType: "annual_accounts_submission_failed",
      correlationId: identifiers?.submissionNumber,
      requestPayload: requestSummary ?? {
        periodKey: context.period.periodKey,
        environment: provider.environment,
        presenterId: provider.presenterId,
        packageReference: provider.packageReference,
      },
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function pollAnnualAccountsSubmission(
  db: Database,
  params: {
    teamId: string;
    periodKey?: string;
    submissionNumber?: string;
  },
) {
  const context = await getYearEndContext(db, params.teamId, params.periodKey);
  const events = await listAccountsSubmissionEvents(db, {
    teamId: params.teamId,
    periodKey: context.period.periodKey,
  });
  const targetEvent = params.submissionNumber
    ? (events.find(
        (event) =>
          getSubmissionEventRequestSubmissionNumber(event) ===
          params.submissionNumber,
      ) ?? null)
    : (events.find((event) =>
        Boolean(getSubmissionEventRequestSubmissionNumber(event)),
      ) ?? null);
  const submissionNumber =
    params.submissionNumber ??
    getSubmissionEventRequestSubmissionNumber(targetEvent);

  if (!submissionNumber) {
    throw new Error(
      "No Companies House annual accounts submission is available to poll",
    );
  }

  const provider = CompaniesHouseXmlGatewayProvider.fromEnvironment();
  const requestPayload = {
    periodKey: context.period.periodKey,
    submissionNumber,
    companyNumber: context.profile.companyNumber,
    environment: provider.environment,
  };

  try {
    const receipt = await provider.pollSubmissionStatus({
      submissionNumber,
      companyNumber: context.profile.companyNumber ?? undefined,
    });
    const selectedStatus = findCompaniesHouseSubmissionStatus(
      receipt,
      submissionNumber,
    );

    await createSubmissionEventInConvex({
      teamId: params.teamId,
      filingProfileId: context.profile.id,
      provider: "companies-house",
      obligationType: "accounts",
      status: resolveCompaniesHouseAccountsSubmissionStatus(
        receipt,
        submissionNumber,
      ),
      eventType: "annual_accounts_polled",
      correlationId: submissionNumber,
      requestPayload,
      responsePayload: {
        ...receipt,
        selectedStatus,
      } as unknown as Record<string, unknown>,
    });

    return {
      receipt,
      previousSubmission: targetEvent,
    };
  } catch (error) {
    await createSubmissionEventInConvex({
      teamId: params.teamId,
      filingProfileId: context.profile.id,
      provider: "companies-house",
      obligationType: "accounts",
      status: "failed",
      eventType: "annual_accounts_poll_failed",
      correlationId: submissionNumber,
      requestPayload,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
