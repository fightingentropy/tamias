import {
  assertExternalMutationEnvironment,
  CompaniesHouseXmlGatewayProvider,
} from "@tamias/compliance";
import type { Database } from "../../../client";
import { createSubmissionEvent } from "../../filing-events";
import {
  beginIdempotentOperation,
  completeIdempotentOperation,
  failIdempotentOperation,
  requireIdempotentOperationReconciliation,
} from "../../operational-safety";
import { buildCtSubmissionArtifacts } from "../drafts";
import { getYearEndContext } from "../pack";
import { getYearEndPackByPeriod } from "../pack-store";
import {
  getSubmissionEventRequestSubmissionNumber,
  listYearEndSubmissionEvents,
  requireReadyYearEndPack,
} from "../submission-common";
import {
  getCloseCompanyLoansScheduleByPeriod,
  getCorporationTaxRateScheduleByPeriod,
} from "../tax-schedules";
import { allocateCompaniesHouseSubmissionIdentifiers } from "./identifiers";
import {
  buildCompaniesHouseAccountsSubmissionRequestSummary,
  findCompaniesHouseSubmissionStatus,
  resolveCompaniesHouseAccountsSubmissionStatus,
} from "./status";

type CompaniesHouseSubmissionResult = {
  receipt: Awaited<ReturnType<CompaniesHouseXmlGatewayProvider["submitAccountsXml"]>>;
  request: ReturnType<typeof buildCompaniesHouseAccountsSubmissionRequestSummary> & {
    submittedBy: string;
  };
};

export async function listAccountsSubmissionEvents(
  db: Database,
  params: { teamId: string; periodKey?: string },
) {
  return listYearEndSubmissionEvents(db, {
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
    idempotencyKey: string;
    confirmationId: string;
  },
): Promise<CompaniesHouseSubmissionResult> {
  const context = await getYearEndContext(db, params.teamId, params.periodKey);
  const [packRecord, closeCompanyLoansSchedule, corporationTaxRateSchedule] = await Promise.all([
    getYearEndPackByPeriod(db, {
      teamId: params.teamId,
      filingProfileId: context.profile.id,
      periodKey: context.period.periodKey,
    }),
    getCloseCompanyLoansScheduleByPeriod(db, {
      teamId: params.teamId,
      filingProfileId: context.profile.id,
      periodKey: context.period.periodKey,
    }),
    getCorporationTaxRateScheduleByPeriod(db, {
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
    throw new Error("Declaration must be accepted before Companies House accounts submission");
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
    await createSubmissionEvent(db, {
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
  assertExternalMutationEnvironment({ kind: "filing", providerEnvironment: provider.environment });
  const operation = await beginIdempotentOperation(db, {
    teamId: params.teamId,
    scope: "filing.companies-house.accounts.submit",
    idempotencyKey: params.idempotencyKey,
    request: {
      periodKey: context.period.periodKey,
      filingProfileId: context.profile.id,
      environment: provider.environment,
      packId: pack.id,
    },
  });
  if (operation.state === "replayed") {
    return operation.result as CompaniesHouseSubmissionResult;
  }

  let identifiers: Awaited<ReturnType<typeof allocateCompaniesHouseSubmissionIdentifiers>> | null =
    null;
  let requestSummary:
    | (ReturnType<typeof buildCompaniesHouseAccountsSubmissionRequestSummary> & {
        submittedBy: string;
      })
    | null = null;
  let providerAttempted = false;
  let providerReceipt: CompaniesHouseSubmissionResult["receipt"] | null = null;

  try {
    identifiers = await allocateCompaniesHouseSubmissionIdentifiers(db, provider);
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
        submissionArtifacts.statutoryAccountsDraft.approvalDate ?? context.period.periodEnd,
      accountsIxbrl: submissionArtifacts.accountsAttachmentIxbrl,
      submissionNumber: identifiers.submissionNumber,
      transactionId: identifiers.transactionId,
      customerReference: requestSummary.customerReference,
    });
    providerAttempted = true;
    const receipt = await provider.submitAccountsXml(submissionXml);
    providerReceipt = receipt;
    const selectedStatus = findCompaniesHouseSubmissionStatus(
      receipt,
      identifiers.submissionNumber,
    );

    await createSubmissionEvent(db, {
      teamId: params.teamId,
      filingProfileId: context.profile.id,
      provider: "companies-house",
      obligationType: "accounts",
      status: resolveCompaniesHouseAccountsSubmissionStatus(receipt, identifiers.submissionNumber),
      eventType: "annual_accounts_submitted",
      correlationId: identifiers.submissionNumber,
      requestPayload: requestSummary,
      responsePayload: {
        ...receipt,
        selectedStatus,
      } as unknown as Record<string, unknown>,
    });

    const result = {
      receipt,
      request: requestSummary,
    };
    await completeIdempotentOperation(db, {
      teamId: params.teamId,
      scope: "filing.companies-house.accounts.submit",
      idempotencyKey: params.idempotencyKey,
      leaseToken: operation.leaseToken,
      result,
      audit: {
        actorType: "user",
        actorId: params.submittedBy,
        action: "filing.companies-house.accounts.submitted",
        resourceType: "year_end_pack",
        resourceId: pack.id,
        confirmationId: params.confirmationId,
        environment: provider.environment,
        payload: {
          filingProfileId: context.profile.id,
          periodKey: context.period.periodKey,
          submissionNumber: identifiers.submissionNumber,
        },
      },
      outbox: {
        topic: "filing.companies-house.accounts.submitted",
        aggregateType: "year_end_pack",
        aggregateId: pack.id,
        payload: {
          filingProfileId: context.profile.id,
          periodKey: context.period.periodKey,
          submissionNumber: identifiers.submissionNumber,
        },
      },
    });
    return result;
  } catch (error) {
    if (providerAttempted) {
      await requireIdempotentOperationReconciliation(db, {
        teamId: params.teamId,
        scope: "filing.companies-house.accounts.submit",
        idempotencyKey: params.idempotencyKey,
        leaseToken: operation.leaseToken,
        error,
        providerResult: providerReceipt ?? {
          outcome: "unknown_after_provider_attempt",
        },
      });
    } else {
      await failIdempotentOperation(db, {
        teamId: params.teamId,
        scope: "filing.companies-house.accounts.submit",
        idempotencyKey: params.idempotencyKey,
        leaseToken: operation.leaseToken,
        error,
      });
    }
    await createSubmissionEvent(db, {
      teamId: params.teamId,
      filingProfileId: context.profile.id,
      provider: "companies-house",
      obligationType: "accounts",
      status: providerAttempted ? "reconciliation_required" : "failed",
      eventType: providerAttempted
        ? "annual_accounts_submission_reconciliation_required"
        : "annual_accounts_submission_failed",
      correlationId: identifiers?.submissionNumber,
      requestPayload: requestSummary ?? {
        periodKey: context.period.periodKey,
        environment: provider.environment,
        presenterId: provider.presenterId,
        packageReference: provider.packageReference,
      },
      responsePayload: providerReceipt ?? undefined,
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
        (event) => getSubmissionEventRequestSubmissionNumber(event) === params.submissionNumber,
      ) ?? null)
    : (events.find((event) => Boolean(getSubmissionEventRequestSubmissionNumber(event))) ?? null);
  const submissionNumber =
    params.submissionNumber ?? getSubmissionEventRequestSubmissionNumber(targetEvent);

  if (!submissionNumber) {
    throw new Error("No Companies House annual accounts submission is available to poll");
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
    const selectedStatus = findCompaniesHouseSubmissionStatus(receipt, submissionNumber);

    await createSubmissionEvent(db, {
      teamId: params.teamId,
      filingProfileId: context.profile.id,
      provider: "companies-house",
      obligationType: "accounts",
      status: resolveCompaniesHouseAccountsSubmissionStatus(receipt, submissionNumber),
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
    await createSubmissionEvent(db, {
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
