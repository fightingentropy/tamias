import { getBankAccounts, getBankConnectionById, patchBankAccount } from "@tamias/app-data/queries";
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
  db: ReturnType<typeof getDb>;
  existingAccounts: DbAccount[];
  apiAccounts: ApiAccount[];
  teamId: string;
}) {
  const matchedDbIds = new Set<string>();

  for (const apiAccount of params.apiAccounts) {
    const match = findMatchingAccount(apiAccount, params.existingAccounts, matchedDbIds);

    if (!match) {
      continue;
    }

    matchedDbIds.add(match.id);

    await patchBankAccount(params.db, {
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

    if (provider !== "truelayer" || connection.provider !== "truelayer") {
      throw new Error(`Unsupported banking provider: ${provider}`);
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

    if (!connection.accessToken) {
      throw new Error("TrueLayer connection not found");
    }

    const accountsResponse = await trpc.banking.getProviderAccounts.query({
      id: connection.referenceId ?? undefined,
      provider: "truelayer",
      accessToken: connection.accessToken,
      institutionId: connection.institutionId ?? undefined,
    });

    if (!accountsResponse.data) {
      throw new Error("TrueLayer accounts verification failed");
    }

    if (existingAccounts.length > 0) {
      await matchAndUpdateAccountIds({
        db,
        existingAccounts,
        apiAccounts: accountsResponse.data,
        teamId,
      });
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
