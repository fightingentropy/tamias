import { getBankAccounts, getBankConnectionById } from "@tamias/app-data/queries";
import { patchBankConnectionInConvex } from "@tamias/app-data-convex";
import { enqueue } from "@tamias/job-client";
import { trpc } from "@tamias/trpc";
import type { WorkerJob as Job } from "../../types/job";
import {
  syncConnectionSchema,
  type SyncBankAccountPayload,
  type SyncConnectionPayload,
} from "../../schemas/transactions";
import { getDb } from "../../utils/db";
import { BaseProcessor } from "../base";
import { syncBankAccount } from "./bank-sync";

const ACCOUNT_DELAY_MS = {
  manual: 30_000,
  background: 60_000,
} as const;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class SyncConnectionProcessor extends BaseProcessor<SyncConnectionPayload> {
  protected getPayloadSchema() {
    return syncConnectionSchema;
  }

  async process(job: Job<SyncConnectionPayload>): Promise<{
    connectionId: string;
    status: "connected" | "disconnected";
    syncedAccounts: number;
    transactionsUpserted: number;
    notificationRunId: string | null;
  }> {
    const { connectionId, manualSync } = job.data;
    const db = getDb();

    await this.updateProgress(job, 10, undefined, "loading-connection");

    const connection = await getBankConnectionById(db, { id: connectionId });

    if (!connection) {
      throw new Error("Connection not found");
    }

    await this.updateProgress(job, 20, undefined, "checking-provider-state");

    const connectionResult = await trpc.banking.connectionStatus.query({
      id: connection.referenceId ?? undefined,
      provider: connection.provider as "gocardless" | "plaid" | "teller",
      accessToken: connection.accessToken ?? undefined,
    });

    const connectionData = connectionResult.data;

    if (!connectionData) {
      throw new Error("Failed to get connection status");
    }

    if (connectionData.status === "disconnected") {
      await patchBankConnectionInConvex({
        id: connectionId,
        teamId: connection.teamId,
        status: "disconnected",
      });

      await this.updateProgress(job, 100, undefined, "completed");

      return {
        connectionId,
        status: "disconnected",
        syncedAccounts: 0,
        transactionsUpserted: 0,
        notificationRunId: null,
      };
    }

    if (connectionData.status !== "connected") {
      throw new Error(`Unsupported connection status: ${connectionData.status}`);
    }

    await patchBankConnectionInConvex({
      id: connectionId,
      teamId: connection.teamId,
      status: "connected",
      lastAccessed: new Date().toISOString(),
    });

    await this.updateProgress(job, 30, undefined, "loading-accounts");

    const bankAccounts = (
      await getBankAccounts(db, {
        teamId: connection.teamId,
        enabled: true,
        manual: false,
      })
    )
      .filter((account) => {
        if (account.bankConnectionId !== connectionId) {
          return false;
        }

        if (manualSync) {
          return true;
        }

        return (account.errorRetries ?? 0) < 4;
      })
      .flatMap((account): SyncBankAccountPayload[] => {
        const provider = account.bankConnection?.provider;

        if (provider !== "gocardless" && provider !== "plaid" && provider !== "teller") {
          return [];
        }

        return [
          {
            id: account.id,
            accountId: account.accountId,
            accessToken: account.bankConnection?.accessToken ?? undefined,
            errorRetries: account.errorRetries ?? undefined,
            provider,
            teamId: account.teamId,
            accountType: account.type ?? "depository",
            currency: account.currency ?? undefined,
            manualSync,
          },
        ];
      });

    if (bankAccounts.length === 0) {
      await this.updateProgress(job, 100, undefined, "completed");

      return {
        connectionId,
        status: "connected",
        syncedAccounts: 0,
        transactionsUpserted: 0,
        notificationRunId: null,
      };
    }

    let syncedAccounts = 0;
    let transactionsUpserted = 0;
    const delayMs = manualSync ? ACCOUNT_DELAY_MS.manual : ACCOUNT_DELAY_MS.background;

    for (const [index, account] of bankAccounts.entries()) {
      if (index > 0) {
        await sleep(delayMs);
      }

      const progress = 35 + Math.round((index / bankAccounts.length) * 45);
      await this.updateProgress(job, progress, undefined, "syncing-account");

      const result = await syncBankAccount(account, this.logger);
      syncedAccounts += 1;
      transactionsUpserted += result.upsertedCount;
    }

    let notificationRunId: string | null = null;

    if (!manualSync) {
      await this.updateProgress(job, 85, undefined, "scheduling-notifications");

      const notificationRun = await enqueue(
        "transaction-notifications",
        {
          teamId: connection.teamId,
        },
        "transactions",
        {
          publicTeamId: connection.teamId,
          delay: 5 * 60 * 1000,
          metadata: {
            source: "sync-connection",
            connectionId,
          },
        },
      );

      notificationRunId = notificationRun.runId;
    }

    await this.updateProgress(job, 92, undefined, "verifying-connection-health");

    try {
      const enabledAccounts = (
        await getBankAccounts(db, {
          teamId: connection.teamId,
          enabled: true,
          manual: false,
        })
      ).filter((account) => account.bankConnectionId === connectionId);

      if (
        enabledAccounts.length > 0 &&
        enabledAccounts.every((account) => (account.errorRetries ?? 0) >= 3)
      ) {
        await patchBankConnectionInConvex({
          id: connectionId,
          teamId: connection.teamId,
          status: "disconnected",
        });

        await this.updateProgress(job, 100, undefined, "completed");

        return {
          connectionId,
          status: "disconnected",
          syncedAccounts,
          transactionsUpserted,
          notificationRunId,
        };
      }
    } catch (error) {
      this.logger.error("Failed to check connection status by accounts", {
        connectionId,
        teamId: connection.teamId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    await this.updateProgress(job, 100, undefined, "completed");

    return {
      connectionId,
      status: "connected",
      syncedAccounts,
      transactionsUpserted,
      notificationRunId,
    };
  }
}
