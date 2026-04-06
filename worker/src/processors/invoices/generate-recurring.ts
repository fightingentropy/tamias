import {
  allocateNextInvoiceNumber,
  checkInvoiceExists,
  draftInvoice,
  getDueInvoiceRecurring,
  markInvoiceGenerated,
  recordInvoiceGenerationFailure,
  updateInvoice,
} from "@tamias/app-data/queries";
import { getCustomerById } from "@tamias/app-data/queries";
import { getStartOfDayUTC } from "@tamias/invoice/recurring";
import { generateToken } from "@tamias/invoice/token";
import { transformCustomerToContent } from "@tamias/invoice/utils";
import { enqueue } from "@tamias/job-client";
import type { WorkerJob as Job } from "../../types/job";
import { addDays } from "date-fns";
import { v4 as uuidv4 } from "uuid";
import {
  RecurringInvoiceError,
  RecurringInvoiceErrors,
} from "../../errors/invoice-errors";
import type { InvoiceRecurringSchedulerPayload } from "../../schemas/invoices";
import { getDb } from "../../utils/db";
import { withDbConnectionRetry } from "../../utils/db-retry";
import { isStaging } from "../../utils/env";
import {
  buildInvoiceTemplateFromRecurring,
  parseLineItems,
  stringifyJsonField,
  validateRecurringDataIntegrity,
} from "../../utils/invoice-template-builder";
import { mapWithConcurrency } from "../../utils/process-batch";
import { BaseProcessor } from "../base";

type GeneratedInvoiceResult = {
  invoiceId: string;
  invoiceNumber: string;
  recurringId: string;
  sequence: number;
};

type ProcessResult = {
  processed: number;
  skipped: number;
  failed: number;
  results: GeneratedInvoiceResult[];
  errors: Array<{ recurringId: string; error: string }>;
  hasMore: boolean;
};

type DueRecurringItem = Awaited<
  ReturnType<typeof getDueInvoiceRecurring>
>["data"][number];
type ProcessSummary = Omit<ProcessResult, "hasMore">;
type SeriesProcessResult =
  | { kind: "processed"; result: GeneratedInvoiceResult }
  | { kind: "skipped" }
  | { kind: "failed"; error: { recurringId: string; error: string } };

const TEAM_PROCESSING_CONCURRENCY = 4;

/**
 * Scheduled processor that generates invoices from recurring invoice series
 * Runs every 2 hours to find and process due recurring invoices
 *
 * Duplicate processing is prevented by:
 * 1. Cloudflare-owned recurring scheduler triggers
 * 2. Idempotency check via checkInvoiceExists (prevents duplicate invoices)
 *
 * Kill switch: Set DISABLE_RECURRING_INVOICES=true to disable processing
 */
export class InvoiceRecurringSchedulerProcessor extends BaseProcessor<InvoiceRecurringSchedulerPayload> {
  async process(
    _job: Job<InvoiceRecurringSchedulerPayload>,
  ): Promise<ProcessResult> {
    // Kill switch - can be toggled without deploy via environment variable
    if (process.env.DISABLE_RECURRING_INVOICES === "true") {
      this.logger.warn(
        "Recurring invoice scheduler disabled via DISABLE_RECURRING_INVOICES",
      );
      return {
        processed: 0,
        skipped: 0,
        failed: 0,
        results: [],
        errors: [],
        hasMore: false,
      };
    }

    const db = getDb();

    // In staging, log what would happen but don't execute
    if (isStaging()) {
      this.logger.info(
        "[STAGING MODE] Recurring invoice scheduler - logging only, no execution",
      );

      const { data: dueRecurring, hasMore } = await withDbConnectionRetry(
        () => getDueInvoiceRecurring(db),
        {
          operationName: "getDueInvoiceRecurring(staging)",
          logger: this.logger,
        },
      );

      if (dueRecurring.length === 0) {
        this.logger.info("[STAGING] No recurring invoices due for generation");
        return {
          processed: 0,
          skipped: 0,
          failed: 0,
          results: [],
          errors: [],
          hasMore: false,
        };
      }

      this.logger.info(
        `[STAGING] Would process ${dueRecurring.length} recurring invoices${hasMore ? " (more pending)" : ""}`,
        {
          count: dueRecurring.length,
          hasMore,
          recurringInvoices: dueRecurring.map((r) => ({
            id: r.id,
            teamId: r.teamId,
            customerName: r.customerName,
            nextScheduledAt: r.nextScheduledAt,
            sequence: r.invoicesGenerated + 1,
            amount: r.amount,
            currency: r.currency,
          })),
        },
      );

      // Return simulated results
      return {
        processed: dueRecurring.length,
        skipped: 0,
        failed: 0,
        results: dueRecurring.map((r) => ({
          invoiceId: `[STAGING-SIMULATED-${r.id.slice(0, 8)}]`,
          invoiceNumber: `[STAGING-SIM-${r.invoicesGenerated + 1}]`,
          recurringId: r.id,
          sequence: r.invoicesGenerated + 1,
        })),
        errors: [],
        hasMore,
      };
    }

    this.logger.info("Starting recurring invoice scheduler");

    // Get due recurring invoices (batched for safety, default limit: 50)
    const { data: dueRecurring, hasMore } = await withDbConnectionRetry(
      () => getDueInvoiceRecurring(db),
      {
        operationName: "getDueInvoiceRecurring",
        logger: this.logger,
      },
    );

    if (dueRecurring.length === 0) {
      this.logger.info("No recurring invoices due for generation");
      return {
        processed: 0,
        skipped: 0,
        failed: 0,
        results: [],
        errors: [],
        hasMore: false,
      };
    }

    this.logger.info(
      `Found ${dueRecurring.length} recurring invoices to process${hasMore ? " (more pending)" : ""}`,
      { count: dueRecurring.length, hasMore },
    );

    const recurringByTeam = new Map<string, DueRecurringItem[]>();
    for (const recurring of dueRecurring) {
      const teamRecurring = recurringByTeam.get(recurring.teamId) ?? [];
      teamRecurring.push(recurring);
      recurringByTeam.set(recurring.teamId, teamRecurring);
    }

    const teamResults = await mapWithConcurrency(
      [...recurringByTeam.values()],
      TEAM_PROCESSING_CONCURRENCY,
      async (teamRecurring) => this.processTeamRecurring(db, teamRecurring),
    );

    const results: GeneratedInvoiceResult[] = [];
    const errors: Array<{ recurringId: string; error: string }> = [];
    let processed = 0;
    let skipped = 0;
    let failed = 0;

    for (const teamResult of teamResults) {
      processed += teamResult.processed;
      skipped += teamResult.skipped;
      failed += teamResult.failed;
      results.push(...teamResult.results);
      errors.push(...teamResult.errors);
    }

    this.logger.info("Recurring invoice scheduler completed", {
      processed,
      skipped,
      failed,
      total: dueRecurring.length,
      hasMore,
    });

    if (hasMore) {
      this.logger.info(
        "More recurring invoices pending - will be processed in next scheduler run",
      );
    }

    return {
      processed,
      skipped,
      failed,
      results,
      errors,
      hasMore,
    };
  }

  private async processTeamRecurring(
    db: ReturnType<typeof getDb>,
    teamRecurring: DueRecurringItem[],
  ): Promise<ProcessSummary> {
    const summary: ProcessSummary = {
      processed: 0,
      skipped: 0,
      failed: 0,
      results: [],
      errors: [],
    };

    for (const recurring of teamRecurring) {
      const result = await this.processRecurringSeries(db, recurring);

      switch (result.kind) {
        case "processed":
          summary.processed++;
          summary.results.push(result.result);
          break;
        case "skipped":
          summary.skipped++;
          break;
        case "failed":
          summary.failed++;
          summary.errors.push(result.error);
          break;
      }
    }

    return summary;
  }

  private async processRecurringSeries(
    db: ReturnType<typeof getDb>,
    recurring: DueRecurringItem,
  ): Promise<SeriesProcessResult> {
    try {
      const nextSequence = recurring.invoicesGenerated + 1;
      const existingInvoice = await checkInvoiceExists(db, {
        invoiceRecurringId: recurring.id,
        recurringSequence: nextSequence,
      });

      if (existingInvoice) {
        if (
          existingInvoice.status === "draft" ||
          existingInvoice.status === "scheduled"
        ) {
          this.logger.info("Found existing invoice for sequence, sending it", {
            recurringId: recurring.id,
            sequence: nextSequence,
            invoiceId: existingInvoice.id,
            status: existingInvoice.status,
          });

          await markInvoiceGenerated(db, {
            id: recurring.id,
            teamId: recurring.teamId,
          });

          await enqueue(
            "generate-invoice",
            {
              invoiceId: existingInvoice.id,
              deliveryType: "create_and_send",
            },
            "invoices",
            {
              publicTeamId: recurring.teamId,
              metadata: {
                source: "invoice-recurring-scheduler",
                recurringId: recurring.id,
              },
            },
          );

          const invoiceNumber =
            existingInvoice.invoiceNumber ?? `REC-${nextSequence}`;
          await enqueue(
            "notification",
            {
              type: "invoice_recurring_generated",
              invoiceId: existingInvoice.id,
              invoiceNumber,
              teamId: recurring.teamId,
              customerName: recurring.customerName ?? undefined,
              recurringId: recurring.id,
              recurringSequence: nextSequence,
              recurringTotalCount: recurring.endCount ?? undefined,
            },
            "notifications",
            {
              publicTeamId: recurring.teamId,
              metadata: {
                source: "invoice-recurring-scheduler",
                recurringId: recurring.id,
              },
            },
          );

          return {
            kind: "processed",
            result: {
              invoiceId: existingInvoice.id,
              invoiceNumber,
              recurringId: recurring.id,
              sequence: nextSequence,
            },
          };
        }

        this.logger.info(
          "Invoice already exists and was already sent, updating series",
          {
            recurringId: recurring.id,
            sequence: nextSequence,
            status: existingInvoice.status,
          },
        );

        await markInvoiceGenerated(db, {
          id: recurring.id,
          teamId: recurring.teamId,
        });

        return { kind: "skipped" };
      }

      const validation = validateRecurringDataIntegrity(recurring);
      if (!validation.isValid) {
        throw RecurringInvoiceErrors.templateInvalid(
          recurring.id,
          validation.errors.join(", "),
          recurring.teamId,
        );
      }

      let customerDetails: string | null = null;
      let customerEmail: string | null = null;

      if (recurring.customerId) {
        const customer = await getCustomerById(db, {
          id: recurring.customerId,
          teamId: recurring.teamId,
        });

        if (!customer) {
          throw RecurringInvoiceErrors.customerNotFound(
            recurring.id,
            recurring.customerId,
            recurring.teamId,
          );
        }

        const customerContent = transformCustomerToContent(customer);
        customerDetails = customerContent
          ? JSON.stringify(customerContent)
          : null;
        customerEmail = customer.billingEmail || customer.email;

        if (!customerEmail) {
          throw RecurringInvoiceErrors.customerNoEmail(
            recurring.id,
            recurring.customerName || customer.name,
            recurring.teamId,
          );
        }
      } else {
        throw RecurringInvoiceErrors.customerDeleted(
          recurring.id,
          recurring.customerName,
          recurring.teamId,
        );
      }

      const invoiceId = uuidv4();
      const invoiceNumber = await allocateNextInvoiceNumber(
        db,
        recurring.teamId,
      );
      const token = await generateToken(invoiceId);
      const scheduledDate = recurring.nextScheduledAt
        ? new Date(recurring.nextScheduledAt)
        : new Date();
      const issueDateUTC = getStartOfDayUTC(scheduledDate);
      const issueDate = issueDateUTC.toISOString();
      const dueDate = addDays(
        issueDateUTC,
        recurring.dueDateOffset,
      ).toISOString();
      const template = buildInvoiceTemplateFromRecurring(recurring);

      await draftInvoice(db, {
        id: invoiceId,
        teamId: recurring.teamId,
        userId: recurring.userId,
        token,
        template,
        templateId: recurring.templateId ?? undefined,
        paymentDetails: stringifyJsonField(recurring.paymentDetails),
        fromDetails: stringifyJsonField(recurring.fromDetails),
        customerDetails,
        noteDetails: stringifyJsonField(recurring.noteDetails),
        dueDate,
        issueDate,
        invoiceNumber,
        vat: recurring.vat ?? undefined,
        tax: recurring.tax ?? undefined,
        discount: recurring.discount ?? undefined,
        subtotal: recurring.subtotal ?? undefined,
        topBlock: stringifyJsonField(recurring.topBlock),
        bottomBlock: stringifyJsonField(recurring.bottomBlock),
        amount: recurring.amount ?? undefined,
        lineItems: parseLineItems(recurring.lineItems),
        customerId: recurring.customerId ?? undefined,
        customerName: recurring.customerName ?? undefined,
      });

      await updateInvoice(db, {
        id: invoiceId,
        teamId: recurring.teamId,
        sentTo: customerEmail,
        invoiceRecurringId: recurring.id,
        recurringSequence: nextSequence,
      });

      const updatedRecurring = await markInvoiceGenerated(db, {
        id: recurring.id,
        teamId: recurring.teamId,
      });

      this.logger.info("Generated recurring invoice", {
        invoiceId,
        invoiceNumber,
        recurringId: recurring.id,
        sequence: nextSequence,
        customerName: recurring.customerName,
      });

      try {
        await enqueue(
          "generate-invoice",
          {
            invoiceId,
            deliveryType: "create_and_send",
          },
          "invoices",
          {
            publicTeamId: recurring.teamId,
            metadata: {
              source: "invoice-recurring-scheduler",
              recurringId: recurring.id,
            },
          },
        );

        await enqueue(
          "notification",
          {
            type: "invoice_recurring_generated",
            invoiceId,
            invoiceNumber,
            teamId: recurring.teamId,
            customerName: recurring.customerName ?? undefined,
            recurringId: recurring.id,
            recurringSequence: nextSequence,
            recurringTotalCount: recurring.endCount ?? undefined,
          },
          "notifications",
          {
            publicTeamId: recurring.teamId,
            metadata: {
              source: "invoice-recurring-scheduler",
              recurringId: recurring.id,
            },
          },
        );

        if (updatedRecurring?.status === "completed") {
          await enqueue(
            "notification",
            {
              type: "recurring_series_completed",
              invoiceId,
              invoiceNumber,
              teamId: recurring.teamId,
              customerName: recurring.customerName ?? undefined,
              recurringId: recurring.id,
              totalGenerated: nextSequence,
            },
            "notifications",
            {
              publicTeamId: recurring.teamId,
              metadata: {
                source: "invoice-recurring-scheduler",
                recurringId: recurring.id,
              },
            },
          );

          this.logger.info("Recurring invoice series completed", {
            recurringId: recurring.id,
            teamId: recurring.teamId,
            totalGenerated: nextSequence,
          });
        }
      } catch (queueError) {
        const queueErrorMessage =
          queueError instanceof Error ? queueError.message : "Unknown error";
        this.logger.error(
          "Failed to queue jobs for recurring invoice - invoice was created but delivery pending",
          {
            invoiceId,
            invoiceNumber,
            recurringId: recurring.id,
            sequence: nextSequence,
            error: queueErrorMessage,
          },
        );
      }

      return {
        kind: "processed",
        result: {
          invoiceId,
          invoiceNumber,
          recurringId: recurring.id,
          sequence: nextSequence,
        },
      };
    } catch (error) {
      const isRecurringError = error instanceof RecurringInvoiceError;
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      const errorCode = isRecurringError ? error.code : "UNKNOWN";

      this.logger.error("Failed to generate recurring invoice", {
        recurringId: recurring.id,
        errorCode,
        error: errorMessage,
        requiresUserAction: isRecurringError
          ? error.requiresUserAction
          : undefined,
      });

      const { autoPaused } = await recordInvoiceGenerationFailure(db, {
        id: recurring.id,
        teamId: recurring.teamId,
      });

      if (autoPaused) {
        this.logger.warn(
          "Auto-paused recurring invoice due to repeated failures",
          {
            recurringId: recurring.id,
            teamId: recurring.teamId,
            errorCode,
          },
        );

        await enqueue(
          "notification",
          {
            type: "recurring_series_paused",
            teamId: recurring.teamId,
            customerName: recurring.customerName ?? undefined,
            recurringId: recurring.id,
          },
          "notifications",
          {
            publicTeamId: recurring.teamId,
            metadata: {
              source: "invoice-recurring-scheduler",
              recurringId: recurring.id,
            },
          },
        );
      }

      return {
        kind: "failed",
        error: {
          recurringId: recurring.id,
          error: isRecurringError ? error.getUserMessage() : errorMessage,
        },
      };
    }
  }
}
