import {
  configureCloudflareQueueRuntime,
  configureCloudflareScheduleRuntime,
} from "@tamias/job-client";
import "./runtime-shims";
import type { CloudflareAsyncMessage } from "./bridge-helpers";
import {
  isSupportedCloudflareMessage,
} from "./bridge-helpers";
import { configureCloudflareImagesBinding } from "./images-client";
import { createCloudflareScheduleRuntime } from "./schedule-runtime";
import {
  type CloudflareAsyncEnv,
  handleProcessorMessage,
  logger,
  updateRunStatus,
} from "./shared";

function configureCaptureRuntime(env: CloudflareAsyncEnv) {
  configureCloudflareQueueRuntime({
    captureQueue: env.CAPTURE_QUEUE,
    ledgerQueue: env.LEDGER_QUEUE,
  });
  configureCloudflareScheduleRuntime(createCloudflareScheduleRuntime(env));
  configureCloudflareImagesBinding(env.IMAGES);
}

async function processSyncInstitutionsMessage(
  message: Message<CloudflareAsyncMessage>,
) {
  return handleProcessorMessage(message, async () => {
    const { SyncInstitutionsProcessor } = await import(
      "../processors/institutions/sync-institutions"
    );
    return new SyncInstitutionsProcessor();
  });
}

async function processInboxSyncSchedulerMessage(
  message: Message<CloudflareAsyncMessage>,
) {
  return handleProcessorMessage(message, async () => {
    const { SyncSchedulerProcessor } = await import(
      "../processors/inbox/sync-scheduler"
    );
    return new SyncSchedulerProcessor();
  });
}

async function processNoMatchSchedulerMessage(
  message: Message<CloudflareAsyncMessage>,
) {
  return handleProcessorMessage(message, async () => {
    const { NoMatchSchedulerProcessor } = await import(
      "../processors/inbox/no-match-scheduler"
    );
    return new NoMatchSchedulerProcessor();
  });
}

async function processBatchProcessMatchingMessage(
  message: Message<CloudflareAsyncMessage>,
) {
  return handleProcessorMessage(message, async () => {
    const { BatchProcessMatchingProcessor } = await import(
      "../processors/inbox/batch-process-matching"
    );
    return new BatchProcessMatchingProcessor();
  });
}

async function processInitialInboxSetupMessage(
  message: Message<CloudflareAsyncMessage>,
) {
  return handleProcessorMessage(message, async () => {
    const { InitialSetupProcessor } = await import(
      "../processors/inbox/initial-setup"
    );
    return new InitialSetupProcessor();
  });
}

async function processMatchTransactionsBidirectionalMessage(
  message: Message<CloudflareAsyncMessage>,
) {
  return handleProcessorMessage(message, async () => {
    const { MatchTransactionsBidirectionalProcessor } = await import(
      "../processors/inbox/match-transactions-bidirectional"
    );
    return new MatchTransactionsBidirectionalProcessor();
  });
}

async function processAttachmentMessage(
  message: Message<CloudflareAsyncMessage>,
) {
  return handleProcessorMessage(message, async () => {
    const { ProcessAttachmentProcessor } = await import(
      "../processors/inbox/process-attachment"
    );
    return new ProcessAttachmentProcessor();
  });
}

async function processSlackUploadMessage(
  message: Message<CloudflareAsyncMessage>,
) {
  return handleProcessorMessage(message, async () => {
    const { SlackUploadProcessor } = await import(
      "../processors/inbox/slack-upload"
    );
    return new SlackUploadProcessor();
  });
}

async function processWhatsAppUploadMessage(
  message: Message<CloudflareAsyncMessage>,
) {
  return handleProcessorMessage(message, async () => {
    const { WhatsAppUploadProcessor } = await import(
      "../processors/inbox/whatsapp-upload"
    );
    return new WhatsAppUploadProcessor();
  });
}

async function processClassifyDocumentMessage(
  message: Message<CloudflareAsyncMessage>,
) {
  return handleProcessorMessage(message, async () => {
    const { ClassifyDocumentProcessor } = await import(
      "../processors/documents/classify-document"
    );
    return new ClassifyDocumentProcessor();
  });
}

async function processDocumentMessage(
  message: Message<CloudflareAsyncMessage>,
) {
  return handleProcessorMessage(message, async () => {
    const { ProcessDocumentProcessor } = await import(
      "../processors/documents/process-document"
    );
    return new ProcessDocumentProcessor();
  });
}

async function processClassifyImageMessage(
  message: Message<CloudflareAsyncMessage>,
  env: CloudflareAsyncEnv,
) {
  const { runCloudflareClassifyImage } = await import("./classify-image");

  return runCloudflareClassifyImage(
    env,
    message.body.payload as {
      fileName: string;
      teamId: string;
    },
  );
}

async function processEmbedDocumentTagsMessage(
  message: Message<CloudflareAsyncMessage>,
) {
  return handleProcessorMessage(message, async () => {
    const { EmbedDocumentTagsProcessor } = await import(
      "../processors/documents/embed-document-tags"
    );
    return new EmbedDocumentTagsProcessor();
  });
}

async function processRatesSchedulerMessage(
  message: Message<CloudflareAsyncMessage>,
) {
  return handleProcessorMessage(message, async () => {
    const { RatesSchedulerProcessor } = await import(
      "../processors/rates/rates-scheduler"
    );
    return new RatesSchedulerProcessor();
  });
}

async function processQueueMessage(
  message: Message<CloudflareAsyncMessage>,
  env: CloudflareAsyncEnv,
) {
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

    if (body.queueName === "inbox" && body.jobName === "no-match-scheduler") {
      result = await processNoMatchSchedulerMessage(message);
    } else if (
      body.queueName === "inbox" &&
      body.jobName === "batch-process-matching"
    ) {
      result = await processBatchProcessMatchingMessage(message);
    } else if (
      body.queueName === "inbox" &&
      body.jobName === "match-transactions-bidirectional"
    ) {
      result = await processMatchTransactionsBidirectionalMessage(message);
    } else if (
      body.queueName === "inbox" &&
      body.jobName === "process-attachment"
    ) {
      result = await processAttachmentMessage(message);
    } else if (body.queueName === "inbox" && body.jobName === "slack-upload") {
      result = await processSlackUploadMessage(message);
    } else if (
      body.queueName === "inbox" &&
      body.jobName === "whatsapp-upload"
    ) {
      result = await processWhatsAppUploadMessage(message);
    } else if (
      body.queueName === "inbox-provider" &&
      body.jobName === "initial-setup"
    ) {
      result = await processInitialInboxSetupMessage(message);
    } else if (
      body.queueName === "inbox-provider" &&
      body.jobName === "sync-scheduler"
    ) {
      result = await processInboxSyncSchedulerMessage(message);
    } else if (
      body.queueName === "documents" &&
      body.jobName === "process-document"
    ) {
      result = await processDocumentMessage(message);
    } else if (
      body.queueName === "documents" &&
      body.jobName === "classify-image"
    ) {
      result = await processClassifyImageMessage(message, env);
    } else if (
      body.queueName === "documents" &&
      body.jobName === "classify-document"
    ) {
      result = await processClassifyDocumentMessage(message);
    } else if (
      body.queueName === "documents" &&
      body.jobName === "embed-document-tags"
    ) {
      result = await processEmbedDocumentTagsMessage(message);
    } else if (
      body.queueName === "institutions" &&
      body.jobName === "sync-institutions"
    ) {
      result = await processSyncInstitutionsMessage(message);
    } else if (
      body.queueName === "rates" &&
      body.jobName === "rates-scheduler"
    ) {
      result = await processRatesSchedulerMessage(message);
    } else {
      throw new Error(
        `Missing Cloudflare capture handler for ${body.queueName}:${body.jobName}`,
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

    logger.error("Cloudflare capture message failed", {
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
    configureCaptureRuntime(env);

    return Response.json({
      status: "ok",
      runtime: "cloudflare-capture-worker",
      environment: env.TAMIAS_ENVIRONMENT ?? "development",
    });
  },

  async queue(
    batch: MessageBatch<CloudflareAsyncMessage>,
    env: CloudflareAsyncEnv,
  ) {
    configureCaptureRuntime(env);

    for (const message of batch.messages) {
      await processQueueMessage(message, env);
    }
  },
};
