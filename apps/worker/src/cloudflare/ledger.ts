import {
  configureBankingRuntime,
} from "@tamias/banking";
import {
  configureCloudflareQueueRuntime,
  configureCloudflareScheduleRuntime,
} from "@tamias/job-client";
import "./runtime-shims";
import type { CloudflareAsyncMessage } from "./bridge-helpers";
import { isSupportedCloudflareMessage } from "./bridge-helpers";
import { createCloudflareScheduleRuntime } from "./schedule-runtime";
import {
  type CloudflareAsyncEnv,
  handleProcessorMessage,
  logger,
  updateRunStatus,
} from "./shared";

function configureLedgerRuntime(env: CloudflareAsyncEnv) {
  configureCloudflareQueueRuntime({
    captureQueue: env.CAPTURE_QUEUE,
    ledgerQueue: env.LEDGER_QUEUE,
  });
  configureCloudflareScheduleRuntime(createCloudflareScheduleRuntime(env));
  configureBankingRuntime({
    tellerMtlsFetcher: env.TELLER_MTLS_CERTIFICATE,
  });
}

async function processNotificationMessage(
  message: Message<CloudflareAsyncMessage>,
) {
  return handleProcessorMessage(message, async () => {
    const { NotificationProcessor } = await import(
      "../processors/notifications/notification"
    );
    return new NotificationProcessor();
  });
}

async function processInvoiceStatusSchedulerMessage(
  message: Message<CloudflareAsyncMessage>,
) {
  return handleProcessorMessage(message, async () => {
    const { InvoiceStatusSchedulerProcessor } = await import(
      "../processors/invoices/invoice-status-scheduler"
    );
    return new InvoiceStatusSchedulerProcessor();
  });
}

async function processInvoiceRecurringSchedulerMessage(
  message: Message<CloudflareAsyncMessage>,
) {
  return handleProcessorMessage(message, async () => {
    const { InvoiceRecurringSchedulerProcessor } = await import(
      "../processors/invoices/generate-recurring"
    );
    return new InvoiceRecurringSchedulerProcessor();
  });
}

async function processInvoiceUpcomingNotificationMessage(
  message: Message<CloudflareAsyncMessage>,
) {
  return handleProcessorMessage(message, async () => {
    const { InvoiceUpcomingNotificationProcessor } = await import(
      "../processors/invoices/upcoming-notification"
    );
    return new InvoiceUpcomingNotificationProcessor();
  });
}

async function processGenerateInvoiceMessage(
  message: Message<CloudflareAsyncMessage>,
) {
  return handleProcessorMessage(message, async () => {
    const { GenerateInvoiceProcessor } = await import(
      "../processors/invoices/generate-invoice"
    );
    return new GenerateInvoiceProcessor();
  });
}

async function processSendInvoiceEmailMessage(
  message: Message<CloudflareAsyncMessage>,
) {
  return handleProcessorMessage(message, async () => {
    const { SendInvoiceEmailProcessor } = await import(
      "../processors/invoices/send-invoice-email"
    );
    return new SendInvoiceEmailProcessor();
  });
}

async function processSendInvoiceReminderMessage(
  message: Message<CloudflareAsyncMessage>,
) {
  return handleProcessorMessage(message, async () => {
    const { SendInvoiceReminderProcessor } = await import(
      "../processors/invoices/send-invoice-reminder"
    );
    return new SendInvoiceReminderProcessor();
  });
}

async function processScheduleInvoiceMessage(
  message: Message<CloudflareAsyncMessage>,
) {
  return handleProcessorMessage(message, async () => {
    const { ScheduleInvoiceProcessor } = await import(
      "../processors/invoices/schedule-invoice"
    );
    return new ScheduleInvoiceProcessor();
  });
}

async function processDispatchInsightsMessage(
  message: Message<CloudflareAsyncMessage>,
) {
  return handleProcessorMessage(message, async () => {
    const { DispatchInsightsProcessor } = await import(
      "../processors/insights/dispatch-insights"
    );
    return new DispatchInsightsProcessor();
  });
}

async function processGenerateTeamInsightsMessage(
  message: Message<CloudflareAsyncMessage>,
) {
  return handleProcessorMessage(message, async () => {
    const { GenerateInsightsProcessor } = await import(
      "../processors/insights/generate-team-insights"
    );
    return new GenerateInsightsProcessor();
  });
}

async function processBankSyncSchedulerMessage(
  message: Message<CloudflareAsyncMessage>,
) {
  const payload = message.body.payload as { teamId?: string };

  if (!payload.teamId) {
    throw new Error("teamId is required for bank-sync-scheduler");
  }

  const { runBankSyncScheduler } = await import("./bank-sync-scheduler");
  return runBankSyncScheduler(payload.teamId);
}

async function processDeleteConnectionMessage(
  message: Message<CloudflareAsyncMessage>,
) {
  return handleProcessorMessage(message, async () => {
    const { DeleteConnectionProcessor } = await import(
      "../processors/transactions/delete-connection"
    );
    return new DeleteConnectionProcessor();
  });
}

async function processReconnectConnectionMessage(
  message: Message<CloudflareAsyncMessage>,
) {
  return handleProcessorMessage(message, async () => {
    const { ReconnectConnectionProcessor } = await import(
      "../processors/transactions/reconnect-connection"
    );
    return new ReconnectConnectionProcessor();
  });
}

async function processEnrichTransactionsMessage(
  message: Message<CloudflareAsyncMessage>,
) {
  return handleProcessorMessage(message, async () => {
    const { EnrichTransactionProcessor } = await import(
      "../processors/transactions/enrich-transaction"
    );
    return new EnrichTransactionProcessor();
  });
}

async function processExportTransactionsMessage(
  message: Message<CloudflareAsyncMessage>,
) {
  return handleProcessorMessage(message, async () => {
    const { ExportTransactionsProcessor } = await import(
      "../processors/transactions/export"
    );
    return new ExportTransactionsProcessor();
  });
}

async function processImportTransactionsMessage(
  message: Message<CloudflareAsyncMessage>,
) {
  return handleProcessorMessage(message, async () => {
    const { ImportTransactionsProcessor } = await import(
      "../processors/transactions/import-transactions"
    );
    return new ImportTransactionsProcessor();
  });
}

async function processProcessTransactionAttachmentMessage(
  message: Message<CloudflareAsyncMessage>,
) {
  return handleProcessorMessage(message, async () => {
    const { ProcessTransactionAttachmentProcessor } = await import(
      "../processors/transactions/process-attachment"
    );
    return new ProcessTransactionAttachmentProcessor();
  });
}

async function processSyncConnectionMessage(
  message: Message<CloudflareAsyncMessage>,
) {
  return handleProcessorMessage(message, async () => {
    const { SyncConnectionProcessor } = await import(
      "../processors/transactions/sync-connection"
    );
    return new SyncConnectionProcessor();
  });
}

async function processTransactionNotificationsMessage(
  message: Message<CloudflareAsyncMessage>,
) {
  return handleProcessorMessage(message, async () => {
    const { TransactionNotificationsProcessor } = await import(
      "../processors/transactions/transaction-notifications"
    );
    return new TransactionNotificationsProcessor();
  });
}

async function processUpdateAccountBaseCurrencyMessage(
  message: Message<CloudflareAsyncMessage>,
) {
  return handleProcessorMessage(message, async () => {
    const { UpdateAccountBaseCurrencyProcessor } = await import(
      "../processors/transactions/update-account-base-currency"
    );
    return new UpdateAccountBaseCurrencyProcessor();
  });
}

async function processUpdateBaseCurrencyMessage(
  message: Message<CloudflareAsyncMessage>,
) {
  return handleProcessorMessage(message, async () => {
    const { UpdateBaseCurrencyProcessor } = await import(
      "../processors/transactions/update-base-currency"
    );
    return new UpdateBaseCurrencyProcessor();
  });
}

async function processExportToAccountingMessage(
  message: Message<CloudflareAsyncMessage>,
) {
  return handleProcessorMessage(message, async () => {
    const { ExportTransactionsProcessor } = await import(
      "../processors/accounting/export-transactions"
    );
    return new ExportTransactionsProcessor();
  });
}

async function processSyncAccountingAttachmentsMessage(
  message: Message<CloudflareAsyncMessage>,
) {
  return handleProcessorMessage(message, async () => {
    const { SyncAttachmentsProcessor } = await import(
      "../processors/accounting/sync-attachments"
    );
    return new SyncAttachmentsProcessor();
  });
}

async function processEnrichCustomerMessage(
  message: Message<CloudflareAsyncMessage>,
) {
  return handleProcessorMessage(message, async () => {
    const { EnrichCustomerProcessor } = await import(
      "../processors/customers/enrich-customer"
    );
    return new EnrichCustomerProcessor();
  });
}

async function processPaymentIssueMessage(
  message: Message<CloudflareAsyncMessage>,
) {
  return handleProcessorMessage(message, async () => {
    const { PaymentIssueProcessor } = await import(
      "../processors/teams/payment-issue"
    );
    return new PaymentIssueProcessor();
  });
}

async function processInviteTeamMembersMessage(
  message: Message<CloudflareAsyncMessage>,
) {
  return handleProcessorMessage(message, async () => {
    const { InviteTeamMembersProcessor } = await import(
      "../processors/teams/invite-team-members"
    );
    return new InviteTeamMembersProcessor();
  });
}

async function processDeleteTeamMessage(
  message: Message<CloudflareAsyncMessage>,
) {
  return handleProcessorMessage(message, async () => {
    const { DeleteTeamProcessor } = await import(
      "../processors/teams/delete-team"
    );
    return new DeleteTeamProcessor();
  });
}

async function processQueueMessage(message: Message<CloudflareAsyncMessage>) {
  const body = message.body;

  if (!isSupportedCloudflareMessage(body)) {
    logger.error("Unsupported Cloudflare async message", {
      queue: body.queue,
      queueName: body.queueName,
      jobName: body.jobName,
      runId: body.runId,
      attempts: message.attempts,
    });

    await updateRunStatus(body.runId, {
      status: "failed",
      error: `Unsupported Cloudflare job ${body.queueName}:${body.jobName}`,
      completedAt: new Date().toISOString(),
    });
    message.ack();
    return;
  }

  await updateRunStatus(body.runId, {
    status: "active",
    startedAt: new Date().toISOString(),
    progress: 0,
    progressStep: "started",
  });

  try {
    let result: unknown;

    if (
      body.queueName === "transactions" &&
      body.jobName === "bank-sync-scheduler"
    ) {
      result = await processBankSyncSchedulerMessage(message);
    } else if (
      body.queueName === "transactions" &&
      body.jobName === "delete-connection"
    ) {
      result = await processDeleteConnectionMessage(message);
    } else if (
      body.queueName === "transactions" &&
      body.jobName === "reconnect-connection"
    ) {
      result = await processReconnectConnectionMessage(message);
    } else if (
      body.queueName === "transactions" &&
      body.jobName === "enrich-transactions"
    ) {
      result = await processEnrichTransactionsMessage(message);
    } else if (
      body.queueName === "transactions" &&
      body.jobName === "export-transactions"
    ) {
      result = await processExportTransactionsMessage(message);
    } else if (
      body.queueName === "transactions" &&
      body.jobName === "import-transactions"
    ) {
      result = await processImportTransactionsMessage(message);
    } else if (
      body.queueName === "transactions" &&
      body.jobName === "process-transaction-attachment"
    ) {
      result = await processProcessTransactionAttachmentMessage(message);
    } else if (
      body.queueName === "transactions" &&
      body.jobName === "sync-connection"
    ) {
      result = await processSyncConnectionMessage(message);
    } else if (
      body.queueName === "transactions" &&
      body.jobName === "transaction-notifications"
    ) {
      result = await processTransactionNotificationsMessage(message);
    } else if (
      body.queueName === "transactions" &&
      body.jobName === "update-account-base-currency"
    ) {
      result = await processUpdateAccountBaseCurrencyMessage(message);
    } else if (
      body.queueName === "transactions" &&
      body.jobName === "update-base-currency"
    ) {
      result = await processUpdateBaseCurrencyMessage(message);
    } else if (
      body.queueName === "accounting" &&
      body.jobName === "export-to-accounting"
    ) {
      result = await processExportToAccountingMessage(message);
    } else if (
      body.queueName === "accounting" &&
      body.jobName === "sync-accounting-attachments"
    ) {
      result = await processSyncAccountingAttachmentsMessage(message);
    } else if (
      body.queueName === "invoices" &&
      body.jobName === "invoice-recurring-scheduler"
    ) {
      result = await processInvoiceRecurringSchedulerMessage(message);
    } else if (
      body.queueName === "invoices" &&
      body.jobName === "invoice-status-scheduler"
    ) {
      result = await processInvoiceStatusSchedulerMessage(message);
    } else if (
      body.queueName === "invoices" &&
      body.jobName === "invoice-upcoming-notification"
    ) {
      result = await processInvoiceUpcomingNotificationMessage(message);
    } else if (
      body.queueName === "invoices" &&
      body.jobName === "generate-invoice"
    ) {
      result = await processGenerateInvoiceMessage(message);
    } else if (
      body.queueName === "invoices" &&
      body.jobName === "send-invoice-email"
    ) {
      result = await processSendInvoiceEmailMessage(message);
    } else if (
      body.queueName === "invoices" &&
      body.jobName === "send-invoice-reminder"
    ) {
      result = await processSendInvoiceReminderMessage(message);
    } else if (
      body.queueName === "invoices" &&
      body.jobName === "schedule-invoice"
    ) {
      result = await processScheduleInvoiceMessage(message);
    } else if (
      body.queueName === "insights" &&
      body.jobName === "dispatch-insights"
    ) {
      result = await processDispatchInsightsMessage(message);
    } else if (
      body.queueName === "insights" &&
      body.jobName === "generate-team-insights"
    ) {
      result = await processGenerateTeamInsightsMessage(message);
    } else if (
      body.queueName === "customers" &&
      body.jobName === "enrich-customer"
    ) {
      result = await processEnrichCustomerMessage(message);
    } else if (
      body.queueName === "notifications" &&
      body.jobName === "notification"
    ) {
      result = await processNotificationMessage(message);
    } else if (
      body.queueName === "teams" &&
      body.jobName === "invite-team-members"
    ) {
      result = await processInviteTeamMembersMessage(message);
    } else if (body.queueName === "teams" && body.jobName === "delete-team") {
      result = await processDeleteTeamMessage(message);
    } else if (body.queueName === "teams" && body.jobName === "payment-issue") {
      result = await processPaymentIssueMessage(message);
    } else {
      throw new Error(
        `Missing Cloudflare ledger handler for ${body.queueName}:${body.jobName}`,
      );
    }

    await updateRunStatus(body.runId, {
      status: "completed",
      progress: 100,
      progressStep: "completed",
      result,
      completedAt: new Date().toISOString(),
    });
    message.ack();
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Unknown Cloudflare worker error";
    const maxAttempts = body.maxAttempts ?? 4;
    const isFinalAttempt = message.attempts >= maxAttempts;

    logger.error("Cloudflare ledger message failed", {
      queueName: body.queueName,
      jobName: body.jobName,
      runId: body.runId,
      attempts: message.attempts,
      maxAttempts,
      finalAttempt: isFinalAttempt,
      error: errorMessage,
    });

    await updateRunStatus(body.runId, {
      status: isFinalAttempt ? "failed" : "waiting",
      progressStep: isFinalAttempt ? "failed" : "retrying",
      error: errorMessage,
      ...(isFinalAttempt ? { completedAt: new Date().toISOString() } : {}),
    });

    if (isFinalAttempt) {
      message.ack();
      return;
    }

    message.retry();
  }
}

export default {
  fetch(_request: Request, env: CloudflareAsyncEnv) {
    configureLedgerRuntime(env);

    return Response.json({
      status: "ok",
      runtime: "cloudflare-ledger-worker",
      environment: env.TAMIAS_ENVIRONMENT ?? "development",
    });
  },

  async queue(
    batch: MessageBatch<CloudflareAsyncMessage>,
    env: CloudflareAsyncEnv,
  ) {
    configureLedgerRuntime(env);

    for (const message of batch.messages) {
      await processQueueMessage(message);
    }
  },
};
