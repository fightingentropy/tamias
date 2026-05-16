import {
  getUnnotifiedTransactionsFromD1,
  requireTransactionsD1,
  toTransactionUpsertInput,
  upsertTransactionsInD1,
} from "@tamias/app-data/queries/transactions";
import { Notifications } from "@tamias/notifications";
import { parseISO } from "date-fns";
import type { WorkerJob as Job } from "../../types/job";
import {
  transactionNotificationsSchema,
  type TransactionNotificationsPayload,
} from "../../schemas/transactions";
import { getDb } from "../../utils/db";
import { BaseProcessor } from "../base";

export class TransactionNotificationsProcessor extends BaseProcessor<TransactionNotificationsPayload> {
  protected getPayloadSchema() {
    return transactionNotificationsSchema;
  }

  async process(job: Job<TransactionNotificationsPayload>): Promise<{
    teamId: string;
    notifiedCount: number;
    notificationCreated: boolean;
  }> {
    const { teamId } = job.data;
    const db = getDb();
    const notifications = new Notifications(db);

    await this.updateProgress(job, 20, undefined, "loading-transactions");

    const pendingTransactions = await getUnnotifiedTransactionsFromD1(requireTransactionsD1(db), {
      teamId,
    });

    if (pendingTransactions.length > 0) {
      await upsertTransactionsInD1(requireTransactionsD1(db), {
        teamId,
        transactions: pendingTransactions.map((transaction) =>
          toTransactionUpsertInput(transaction, { notified: true }),
        ),
      });
    }

    await this.updateProgress(job, 70, undefined, "creating-notification");

    const transactions = pendingTransactions
      .map((transaction) => ({
        id: transaction.id,
        date: transaction.date,
        amount: transaction.amount,
        name: transaction.name,
        currency: transaction.currency,
      }))
      .sort((left, right) => {
        return parseISO(right.date).getTime() - parseISO(left.date).getTime();
      });

    if (transactions.length > 0) {
      await notifications.create(
        "transactions_created",
        teamId,
        { transactions },
        { sendEmail: true },
      );
    }

    await this.updateProgress(job, 100, undefined, "completed");

    return {
      teamId,
      notifiedCount: pendingTransactions.length,
      notificationCreated: transactions.length > 0,
    };
  }
}
