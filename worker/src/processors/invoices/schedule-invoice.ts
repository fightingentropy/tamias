import { getInvoiceById, updateInvoice } from "@tamias/app-data/queries";
import { enqueue } from "@tamias/job-client";
import type { WorkerJob as Job } from "../../types/job";
import type { ScheduleInvoicePayload } from "../../schemas/invoices";
import { getDb } from "../../utils/db";
import { BaseProcessor } from "../base";

type ScheduleInvoiceJob = Job<ScheduleInvoicePayload> & {
  runId?: string;
};

/**
 * Schedule Invoice Processor
 * Handles executing scheduled invoices when their scheduled time arrives.
 * This processor is triggered by a delayed job when the scheduled time is reached.
 */
export class ScheduleInvoiceProcessor extends BaseProcessor<ScheduleInvoicePayload> {
  async process(job: ScheduleInvoiceJob): Promise<void> {
    const { invoiceId } = job.data;
    const db = getDb();

    this.logger.info("Processing scheduled invoice", {
      jobId: job.id,
      invoiceId,
    });

    // Get the invoice to verify it's still scheduled (teamId optional)
    const invoice = await getInvoiceById(db, { id: invoiceId });

    if (!invoice) {
      this.logger.error("Invoice not found", { invoiceId });
      // Don't throw - invoice may have been deleted
      return;
    }

    if (invoice.status !== "scheduled") {
      this.logger.info("Invoice is no longer scheduled, skipping", {
        invoiceId,
        status: invoice.status,
      });
      // Don't throw - this is expected if invoice was cancelled or already sent
      return;
    }

    // Skip if this is a recurring invoice - those are handled by the recurring scheduler
    // This is a defensive check since recurring invoices shouldn't have scheduled jobs
    if (invoice.invoiceRecurringId && !invoice.scheduledJobId) {
      this.logger.info("Invoice is part of recurring series without scheduledJobId, skipping", {
        invoiceId,
        invoiceRecurringId: invoice.invoiceRecurringId,
      });
      return;
    }

    // Verify this job is the currently scheduled one for this invoice.
    if (invoice.scheduledJobId) {
      const currentRunId = typeof job.runId === "string" ? job.runId : undefined;

      if (currentRunId) {
        if (invoice.scheduledJobId !== currentRunId) {
          this.logger.info("Stale scheduled job detected, skipping", {
            invoiceId,
            currentRunId,
            expectedRunId: invoice.scheduledJobId,
          });
          return;
        }
      } else {
        this.logger.warn("Scheduled invoice run is missing async run ID, skipping", {
          invoiceId,
          scheduledJobId: invoice.scheduledJobId,
          currentJobId: job.id,
        });
        return;
      }
    }

    // Update invoice status to unpaid before generating
    const updated = await updateInvoice(db, {
      id: invoiceId,
      teamId: invoice.teamId,
      status: "unpaid",
      // Clear the scheduled job id since it has now executed
      scheduledJobId: null,
    });

    if (!updated) {
      this.logger.error("Failed to update invoice status", { invoiceId });
      throw new Error("Failed to update invoice status");
    }

    // Queue the generate-invoice job to create PDF and send email
    await enqueue(
      "generate-invoice",
      {
        invoiceId,
        deliveryType: "create_and_send",
      },
      "invoices",
      {
        publicTeamId: invoice.teamId,
        metadata: {
          source: "schedule-invoice",
          invoiceId,
        },
      },
    );

    this.logger.info("Scheduled invoice queued for generation", {
      invoiceId,
    });
  }
}
