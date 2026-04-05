import {
  getUnnotifiedTransactionsFromConvex,
  upsertTransactionsInConvex,
} from "@tamias/app-data/convex";
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
    const notifications = new Notifications(getDb());

    await this.updateProgress(job, 20, undefined, "loading-transactions");

    const pendingTransactions = await getUnnotifiedTransactionsFromConvex({
      teamId,
    });

    if (pendingTransactions.length > 0) {
      await upsertTransactionsInConvex({
        teamId,
        transactions: pendingTransactions.map((transaction) => ({
          id: transaction.id,
          createdAt: transaction.createdAt,
          date: transaction.date,
          name: transaction.name,
          method: transaction.method,
          amount: transaction.amount,
          currency: transaction.currency,
          assignedId: transaction.assignedId,
          note: transaction.note,
          bankAccountId: transaction.bankAccountId,
          internalId: transaction.internalId,
          status: transaction.status,
          balance: transaction.balance,
          manual: transaction.manual,
          notified: true,
          internal: transaction.internal,
          description: transaction.description,
          categorySlug: transaction.categorySlug,
          baseAmount: transaction.baseAmount,
          counterpartyName: transaction.counterpartyName,
          baseCurrency: transaction.baseCurrency,
          taxAmount: transaction.taxAmount,
          taxRate: transaction.taxRate,
          taxType: transaction.taxType,
          recurring: transaction.recurring,
          frequency: transaction.frequency,
          merchantName: transaction.merchantName,
          enrichmentCompleted: transaction.enrichmentCompleted,
        })),
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
