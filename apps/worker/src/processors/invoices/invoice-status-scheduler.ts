import { TZDate } from "@date-fns/tz";
import {
  createAttachments,
  getInvoiceById,
  updateInvoice,
} from "@tamias/app-data/queries";
import {
  getPublicInvoicesByStatusesFromConvex,
  getTransactionsByAmountRangeFromConvex,
} from "@tamias/app-data-convex";
import { enqueue } from "@tamias/job-client";
import { format, subDays } from "date-fns";
import type { InvoiceStatusSchedulerPayload } from "../../schemas/invoices";
import type { WorkerJob as Job } from "../../types/job";
import { getDb } from "../../utils/db";
import { isProduction } from "../../utils/env";
import { mapWithConcurrency } from "../../utils/process-batch";
import { BaseProcessor } from "../base";

type InvoiceStatusCheckResult =
  | { kind: "paid"; invoiceId: string }
  | { kind: "overdue"; invoiceId: string }
  | { kind: "skipped"; invoiceId: string }
  | { kind: "failed"; invoiceId: string; error: string };

type ProcessResult = {
  processed: number;
  skipped: number;
  failed: number;
  paid: number;
  overdue: number;
  errors: Array<{ invoiceId: string; error: string }>;
};

const INVOICE_STATUS_CHECK_CONCURRENCY = 10;
const INVOICE_MATCH_CANDIDATE_LIMIT = 100;

export class InvoiceStatusSchedulerProcessor extends BaseProcessor<InvoiceStatusSchedulerPayload> {
  async process(
    job: Job<InvoiceStatusSchedulerPayload>,
  ): Promise<ProcessResult> {
    if (!isProduction()) {
      this.logger.info(
        "Skipping invoice status scheduler in non-production environment",
      );
      return {
        processed: 0,
        skipped: 0,
        failed: 0,
        paid: 0,
        overdue: 0,
        errors: [],
      };
    }

    await this.updateProgress(job, 10, undefined, "loading-invoices");

    const invoiceIds = (
      await getPublicInvoicesByStatusesFromConvex({
        statuses: ["unpaid", "overdue"],
      })
    )
      .map((record) => record.payload as { id?: string } | null)
      .filter((record): record is { id: string } => !!record?.id)
      .map((record) => record.id);

    if (invoiceIds.length === 0) {
      await this.updateProgress(job, 100, undefined, "completed");
      return {
        processed: 0,
        skipped: 0,
        failed: 0,
        paid: 0,
        overdue: 0,
        errors: [],
      };
    }

    await this.updateProgress(job, 30, undefined, "checking-invoices");

    const results = await mapWithConcurrency(
      invoiceIds,
      INVOICE_STATUS_CHECK_CONCURRENCY,
      async (invoiceId) => this.checkInvoiceStatus(invoiceId),
    );

    const summary: ProcessResult = {
      processed: 0,
      skipped: 0,
      failed: 0,
      paid: 0,
      overdue: 0,
      errors: [],
    };

    for (const result of results) {
      switch (result.kind) {
        case "paid":
          summary.processed += 1;
          summary.paid += 1;
          break;
        case "overdue":
          summary.processed += 1;
          summary.overdue += 1;
          break;
        case "skipped":
          summary.skipped += 1;
          break;
        case "failed":
          summary.failed += 1;
          summary.errors.push({
            invoiceId: result.invoiceId,
            error: result.error,
          });
          break;
      }
    }

    await this.updateProgress(job, 100, undefined, "completed");

    return summary;
  }

  private async checkInvoiceStatus(
    invoiceId: string,
  ): Promise<InvoiceStatusCheckResult> {
    try {
      const db = getDb();
      const invoice = await getInvoiceById(db, { id: invoiceId });

      if (!invoice) {
        this.logger.warn("Invoice not found during status check", {
          invoiceId,
        });
        return { kind: "skipped", invoiceId };
      }

      if (!invoice.amount || !invoice.currency || !invoice.dueDate) {
        this.logger.warn("Invoice data incomplete for status check", {
          invoiceId,
        });
        return { kind: "skipped", invoiceId };
      }

      const matchingTransactions = await this.findMatchingTransactions(invoice);

      if (matchingTransactions.length === 1) {
        const transactionId = matchingTransactions[0]?.id;
        const filename = `${invoice.invoiceNumber}.pdf`;

        if (
          !transactionId ||
          !invoice.filePath ||
          !invoice.invoiceNumber ||
          invoice.fileSize == null
        ) {
          const error =
            "Invoice attachment data missing for automatic payment match";
          this.logger.warn(error, {
            invoiceId,
            transactionId,
          });
          return { kind: "failed", invoiceId, error };
        }

        await createAttachments(db, {
          teamId: invoice.teamId,
          attachments: [
            {
              type: "application/pdf",
              path: invoice.filePath,
              transactionId,
              name: filename,
              size: invoice.fileSize,
            },
          ],
        });

        const paidAt = new Date().toISOString();
        const updatedInvoice = await updateInvoice(db, {
          id: invoiceId,
          teamId: invoice.teamId,
          status: "paid",
          paidAt,
        });

        await this.enqueueStatusNotification(updatedInvoice, "paid", paidAt);

        return { kind: "paid", invoiceId };
      }

      const timezone =
        (invoice.template as { timezone?: string } | null)?.timezone || "UTC";
      const isOverdue =
        new TZDate(invoice.dueDate, timezone) <
        new TZDate(new Date(), timezone);

      if (isOverdue && invoice.status === "unpaid") {
        const updatedInvoice = await updateInvoice(db, {
          id: invoiceId,
          teamId: invoice.teamId,
          status: "overdue",
        });

        await this.enqueueStatusNotification(updatedInvoice, "overdue");

        return { kind: "overdue", invoiceId };
      }

      return { kind: "skipped", invoiceId };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      this.logger.error("Invoice status check failed", {
        invoiceId,
        error: message,
      });
      return {
        kind: "failed",
        invoiceId,
        error: message,
      };
    }
  }

  private async findMatchingTransactions(invoice: {
    amount: number | null;
    currency: string | null;
    dueDate: string | null;
    status: string;
    teamId: string;
    template?: unknown;
  }) {
    const timezone =
      (invoice.template as { timezone?: string } | null)?.timezone || "UTC";
    const threeDaysAgo = format(
      subDays(new TZDate(new Date(), timezone), 3),
      "yyyy-MM-dd",
    );
    const invoiceAmount =
      typeof invoice.amount === "number" && Number.isFinite(invoice.amount)
        ? invoice.amount
        : null;
    const invoiceCurrency = (invoice.currency ?? "").toUpperCase();

    if (invoiceAmount === null || !invoiceCurrency) {
      return [];
    }

    const amountSearchValue = Math.round(Math.abs(invoiceAmount) * 100);
    const candidateTransactions = await getTransactionsByAmountRangeFromConvex({
      teamId: invoice.teamId,
      minAmount: amountSearchValue,
      maxAmount: amountSearchValue,
      dateGte: threeDaysAgo,
      statusesNotIn: ["completed"],
      limit: INVOICE_MATCH_CANDIDATE_LIMIT,
    });

    return candidateTransactions
      .filter((transaction) => transaction.amount === invoiceAmount)
      .filter((transaction) => transaction.currency === invoiceCurrency)
      .filter((transaction) => !transaction.hasAttachment)
      .map((transaction) => ({ id: transaction.id }));
  }

  private async enqueueStatusNotification(
    updatedInvoice: Awaited<ReturnType<typeof updateInvoice>>,
    status: "paid" | "overdue",
    paidAt?: string,
  ) {
    if (!updatedInvoice?.teamId || !updatedInvoice.invoiceNumber) {
      this.logger.warn(
        "Skipping invoice status notification with missing data",
        {
          invoiceId: updatedInvoice?.id,
          status,
        },
      );
      return;
    }

    if (status === "paid") {
      await enqueue(
        "notification",
        {
          type: "invoice_paid",
          teamId: updatedInvoice.teamId,
          invoiceId: updatedInvoice.id,
          invoiceNumber: updatedInvoice.invoiceNumber,
          customerName: updatedInvoice.customerName ?? undefined,
          paidAt: paidAt ?? updatedInvoice.paidAt ?? undefined,
        },
        "notifications",
        {
          publicTeamId: updatedInvoice.teamId,
          metadata: {
            source: "invoice-status-scheduler",
          },
        },
      );

      return;
    }

    await enqueue(
      "notification",
      {
        type: "invoice_overdue",
        teamId: updatedInvoice.teamId,
        invoiceId: updatedInvoice.id,
        invoiceNumber: updatedInvoice.invoiceNumber,
        customerName: updatedInvoice.customerName ?? undefined,
      },
      "notifications",
      {
        publicTeamId: updatedInvoice.teamId,
        metadata: {
          source: "invoice-status-scheduler",
        },
      },
    );
  }
}
