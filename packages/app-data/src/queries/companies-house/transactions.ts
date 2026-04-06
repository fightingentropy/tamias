import type { CompaniesHouseTransaction } from "@tamias/compliance";
import type { Database } from "../../client";
import { getFilingProfile } from "../compliance/shared";
import {
  createAccountsSubmissionEvent,
  getErrorMessage,
  requireCompaniesHouseProviderData,
} from "./shared";

export async function createCompaniesHouseTransaction(
  db: Database,
  params: {
    teamId: string;
    companyNumber?: string;
    description: string;
    reference?: string;
    resumeJourneyUri?: string;
  },
) {
  const [providerData, profile] = await Promise.all([
    requireCompaniesHouseProviderData(db, params.teamId),
    getFilingProfile(db, params.teamId),
  ]);
  const requestPayload = {
    companyNumber: params.companyNumber ?? profile?.companyNumber ?? undefined,
    description: params.description,
    reference: params.reference,
    resumeJourneyUri: params.resumeJourneyUri,
  };

  try {
    const transaction = await providerData.provider.createTransaction({
      companyNumber: requestPayload.companyNumber,
      description: requestPayload.description,
      reference: requestPayload.reference,
      resumeJourneyUri: requestPayload.resumeJourneyUri,
      accessToken: providerData.config.accessToken,
    });

    await createAccountsSubmissionEvent({
      db,
      teamId: params.teamId,
      eventType: "transaction_created",
      status: transaction.status,
      correlationId: transaction.id,
      requestPayload,
      responsePayload: transaction as unknown as Record<string, unknown>,
    });

    return transaction;
  } catch (error) {
    await createAccountsSubmissionEvent({
      db,
      teamId: params.teamId,
      eventType: "transaction_create_failed",
      status: "error",
      requestPayload,
      errorMessage: getErrorMessage(error),
    });

    throw error;
  }
}

export async function getCompaniesHouseTransaction(
  db: Database,
  params: {
    teamId: string;
    transactionId: string;
  },
) {
  const providerData = await requireCompaniesHouseProviderData(db, params.teamId);

  return providerData.provider.getTransaction({
    transactionId: params.transactionId,
    accessToken: providerData.config.accessToken,
  });
}

async function recordTransactionEvent(args: {
  db: Database;
  teamId: string;
  transactionId: string;
  eventType: string;
  action: () => Promise<CompaniesHouseTransaction | { success: true }>;
}) {
  try {
    const result = await args.action();

    await createAccountsSubmissionEvent({
      db: args.db,
      teamId: args.teamId,
      eventType: args.eventType,
      status: "status" in result && typeof result.status === "string" ? result.status : "deleted",
      correlationId: args.transactionId,
      requestPayload: {
        transactionId: args.transactionId,
      },
      responsePayload: result as unknown as Record<string, unknown>,
    });

    return result;
  } catch (error) {
    await createAccountsSubmissionEvent({
      db: args.db,
      teamId: args.teamId,
      eventType: `${args.eventType}_failed`,
      status: "error",
      correlationId: args.transactionId,
      requestPayload: {
        transactionId: args.transactionId,
      },
      errorMessage: getErrorMessage(error),
    });

    throw error;
  }
}

export async function closeCompaniesHouseTransaction(
  db: Database,
  params: {
    teamId: string;
    transactionId: string;
  },
) {
  const providerData = await requireCompaniesHouseProviderData(db, params.teamId);

  return recordTransactionEvent({
    db,
    teamId: params.teamId,
    transactionId: params.transactionId,
    eventType: "transaction_closed",
    action: () =>
      providerData.provider.closeTransaction({
        transactionId: params.transactionId,
        accessToken: providerData.config.accessToken,
      }),
  });
}

export async function deleteCompaniesHouseTransaction(
  db: Database,
  params: {
    teamId: string;
    transactionId: string;
  },
) {
  const providerData = await requireCompaniesHouseProviderData(db, params.teamId);

  return recordTransactionEvent({
    db,
    teamId: params.teamId,
    transactionId: params.transactionId,
    eventType: "transaction_deleted",
    action: () =>
      providerData.provider.deleteTransaction({
        transactionId: params.transactionId,
        accessToken: providerData.config.accessToken,
      }),
  });
}
