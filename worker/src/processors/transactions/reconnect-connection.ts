import {
  getBankAccounts,
  getBankConnectionById,
} from "@tamias/app-data/queries";
import {
  patchBankAccountInConvex,
  patchBankConnectionInConvex,
} from "@tamias/app-data-convex";
import { enqueue } from "@tamias/job-client";
import { trpc } from "@tamias/trpc";
import {
  findMatchingAccount,
  type ApiAccount,
  type DbAccount,
} from "@tamias/utils/account-matching";
import type { WorkerJob as Job } from "../../types/job";
import {
  reconnectConnectionSchema,
  type ReconnectConnectionPayload,
} from "../../schemas/transactions";
import { getDb } from "../../utils/db";
import { BaseProcessor } from "../base";

async function matchAndUpdateAccountIds(params: {
  existingAccounts: DbAccount[];
  apiAccounts: ApiAccount[];
  teamId: string;
}) {
  const matchedDbIds = new Set<string>();

  for (const apiAccount of params.apiAccounts) {
    const match = findMatchingAccount(
      apiAccount,
      params.existingAccounts,
      matchedDbIds,
    );

    if (!match) {
      continue;
    }

    matchedDbIds.add(match.id);

    await patchBankAccountInConvex({
      id: match.id,
      teamId: params.teamId,
      accountId: apiAccount.id,
      accountReference: apiAccount.resource_id ?? undefined,
      iban: apiAccount.iban ?? undefined,
    });
  }
}

export class ReconnectConnectionProcessor extends BaseProcessor<ReconnectConnectionPayload> {
  protected getPayloadSchema() {
    return reconnectConnectionSchema;
  }

  async process(job: Job<ReconnectConnectionPayload>): Promise<{
    connectionId: string;
    syncRunId: string;
  }> {
    const { teamId, connectionId, provider } = job.data;
    const db = getDb();

    await this.updateProgress(job, 10, undefined, "loading-connection");

    const connection = await getBankConnectionById(db, { id: connectionId });

    if (!connection || connection.teamId !== teamId) {
      throw new Error("Connection not found");
    }

    const existingAccounts = (await getBankAccounts(db, { teamId }))
      .filter((account) => account.bankConnectionId === connectionId)
      .map((account) => ({
        id: account.id,
        account_reference: account.accountReference,
        iban: account.iban,
        type: account.type,
        currency: account.currency,
        name: account.name,
      }));

    await this.updateProgress(job, 30, undefined, "verifying-provider-state");

    if (provider === "gocardless") {
      const connectionResponse = await trpc.banking.connectionByReference.query(
        {
          reference: teamId,
        },
      );

      if (!connectionResponse?.data) {
        throw new Error("Connection not found");
      }

      const referenceId = connectionResponse.data.id;

      if (referenceId) {
        await patchBankConnectionInConvex({
          id: connectionId,
          teamId,
          referenceId,
        });
      }

      const accountsResponse = await trpc.banking.getProviderAccounts.query({
        id: referenceId,
        provider: "gocardless",
      });

      if (!accountsResponse.data) {
        throw new Error("Accounts not found");
      }

      if (existingAccounts.length > 0) {
        await matchAndUpdateAccountIds({
          existingAccounts,
          apiAccounts: accountsResponse.data,
          teamId,
        });
      }
    }

    if (provider === "teller") {
      if (!connection.accessToken || !connection.enrollmentId) {
        throw new Error("Teller connection not found");
      }

      const accountsResponse = await trpc.banking.getProviderAccounts.query({
        id: connection.enrollmentId,
        provider: "teller",
        accessToken: connection.accessToken,
      });

      if (!accountsResponse.data) {
        throw new Error("Teller accounts not found");
      }

      if (existingAccounts.length > 0) {
        await matchAndUpdateAccountIds({
          existingAccounts,
          apiAccounts: accountsResponse.data,
          teamId,
        });
      }
    }

    if (provider === "plaid") {
      if (!connection.accessToken) {
        throw new Error("Plaid connection not found");
      }

      const accountsResponse = await trpc.banking.getProviderAccounts.query({
        provider: "plaid",
        accessToken: connection.accessToken,
        institutionId: connection.institutionId ?? undefined,
      });

      if (!accountsResponse.data) {
        throw new Error("Plaid accounts verification failed");
      }
    }

    await this.updateProgress(job, 80, undefined, "starting-sync");

    const syncRun = await enqueue(
      "sync-connection",
      {
        connectionId,
        manualSync: true,
      },
      "transactions",
      {
        publicTeamId: teamId,
      },
    );

    await this.updateProgress(job, 100, undefined, "completed");

    return {
      connectionId,
      syncRunId: syncRun.runId,
    };
  }
}
