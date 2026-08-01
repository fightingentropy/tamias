import "./runtime-shims";
import { configureCloudflareQueueRuntime } from "@tamias/job-client/cloudflare-runtime";
import { configureEmailRuntime } from "@tamias/email/send";
import { isSupportedCloudflareMessage, type CloudflareAsyncMessage } from "./async-helpers";
import { configureCloudflareImagesBinding } from "./images-client";
import { type CloudflareAsyncEnv, handleProcessorMessage, logger, updateRunStatus } from "./shared";
import { configureWorkerRuntime } from "./worker-runtime";

type DocumentsQueueRequest = {
  attempts?: number;
  id?: string;
  message: CloudflareAsyncMessage;
};

type RenderInvoicePdfRequest = {
  invoiceData?: unknown;
  isReceipt?: boolean;
};

type ExtractStatementPdfRequest = {
  pdfPath?: string[];
};

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function configureDocumentsRuntime(env: CloudflareAsyncEnv) {
  configureCloudflareQueueRuntime({
    captureQueue: env.CAPTURE_QUEUE,
    documentsQueue: env.DOCUMENTS_QUEUE,
    ledgerQueue: env.LEDGER_QUEUE,
  });
  configureCloudflareImagesBinding(env.IMAGES);
  configureEmailRuntime(env.EMAIL);
  configureWorkerRuntime(env);
}

function createDocumentsMessage(request: DocumentsQueueRequest): Message<CloudflareAsyncMessage> {
  return {
    id: request.id ?? crypto.randomUUID(),
    timestamp: new Date(),
    body: request.message,
    attempts: Math.max(1, request.attempts ?? 1),
    ack() {},
    retry() {},
  } as Message<CloudflareAsyncMessage>;
}

async function processDocumentMessage(message: Message<CloudflareAsyncMessage>) {
  return handleProcessorMessage(message, async () => {
    const { ProcessDocumentProcessor } = await import("../processors/documents/process-document");
    return new ProcessDocumentProcessor();
  });
}

async function processClassifyDocumentMessage(message: Message<CloudflareAsyncMessage>) {
  return handleProcessorMessage(message, async () => {
    const { ClassifyDocumentProcessor } = await import("../processors/documents/classify-document");
    return new ClassifyDocumentProcessor();
  });
}

async function processEmbedDocumentTagsMessage(message: Message<CloudflareAsyncMessage>) {
  return handleProcessorMessage(message, async () => {
    const { EmbedDocumentTagsProcessor } =
      await import("../processors/documents/embed-document-tags");
    return new EmbedDocumentTagsProcessor();
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

export async function runDocumentsWorkerMessage(
  request: DocumentsQueueRequest,
  env: CloudflareAsyncEnv,
) {
  configureDocumentsRuntime(env);

  const body = request.message;
  if (
    !isSupportedCloudflareMessage(body) ||
    body.queue !== "documents" ||
    body.queueName !== "documents"
  ) {
    throw new Error(`Unsupported documents worker job ${body.queueName}:${body.jobName}`);
  }

  const message = createDocumentsMessage(request);

  if (body.jobName === "process-document") {
    return processDocumentMessage(message);
  }
  if (body.jobName === "classify-image") {
    return processClassifyImageMessage(message, env);
  }
  if (body.jobName === "classify-document") {
    return processClassifyDocumentMessage(message);
  }
  if (body.jobName === "embed-document-tags") {
    return processEmbedDocumentTagsMessage(message);
  }

  throw new Error(`Missing documents worker handler for ${body.queueName}:${body.jobName}`);
}

async function renderInvoicePdf(request: Request) {
  let payload: RenderInvoicePdfRequest;
  try {
    payload = (await request.json()) as RenderInvoicePdfRequest;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!payload.invoiceData) {
    return Response.json({ error: "invoiceData is required" }, { status: 400 });
  }

  try {
    const { PdfTemplate, renderToBuffer } = await import("@tamias/invoice/pdf");
    const buffer = await renderToBuffer(
      await PdfTemplate(payload.invoiceData as Parameters<typeof PdfTemplate>[0], {
        isReceipt: payload.isReceipt === true,
      }),
    );
    const bytes = new Uint8Array(buffer);

    return new Response(toArrayBuffer(bytes), {
      headers: {
        "content-type": "application/pdf",
        "cache-control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("Documents worker invoice PDF render failed", { error: message });
    return Response.json({ error: message }, { status: 500 });
  }
}

async function extractStatementPdf(request: Request) {
  let payload: ExtractStatementPdfRequest;
  try {
    payload = (await request.json()) as ExtractStatementPdfRequest;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(payload.pdfPath) || payload.pdfPath.length === 0) {
    return Response.json({ error: "pdfPath is required" }, { status: 400 });
  }

  try {
    const statementPdf = await import("./statement-pdf");
    const result = await statementPdf.extractStatementPdfInDocumentsWorker({
      pdfPath: payload.pdfPath,
    });
    return Response.json(result);
  } catch (error) {
    if (error instanceof Error && error.name === "StatementPdfExtractionError") {
      const typedError = error as Error & { code?: string; status?: number };
      return Response.json(
        {
          code: typedError.code,
          error: typedError.message,
        },
        { status: typedError.status ?? 500 },
      );
    }

    const message = error instanceof Error ? error.message : String(error);
    logger.error("Documents worker statement PDF extraction failed", { error: message });
    return Response.json({ error: message }, { status: 500 });
  }
}

async function processQueueMessage(
  message: Message<CloudflareAsyncMessage>,
  env: CloudflareAsyncEnv,
) {
  const { body } = message;
  if (!isSupportedCloudflareMessage(body)) {
    logger.warn("Skipping unsupported documents queue message", {
      queue: body.queue,
      queueName: body.queueName,
      jobName: body.jobName,
    });
    message.ack();
    return;
  }

  try {
    await updateRunStatus(body.runId, {
      status: "active",
      progress: 5,
      progressStep: "Starting document job",
      startedAt: new Date().toISOString(),
    });

    const result = await runDocumentsWorkerMessage(
      {
        attempts: message.attempts,
        id: message.id,
        message: body,
      },
      env,
    );

    await updateRunStatus(body.runId, {
      status: "completed",
      progress: 100,
      progressStep: "Document job completed",
      result,
      completedAt: new Date().toISOString(),
    });
    message.ack();
  } catch (error) {
    const messageText = error instanceof Error ? error.message : String(error);
    const maxAttempts = body.maxAttempts ?? 4;
    const shouldRetry = message.attempts < maxAttempts;

    logger.error("Documents queue message failed", {
      queue: body.queue,
      queueName: body.queueName,
      jobName: body.jobName,
      runId: body.runId,
      attempts: message.attempts,
      maxAttempts,
      error: messageText,
    });

    if (shouldRetry) {
      await updateRunStatus(body.runId, {
        status: "waiting",
        progressStep: `Retrying document job after failure: ${messageText}`,
      });
      message.retry();
      return;
    }

    await updateRunStatus(body.runId, {
      status: "failed",
      error: messageText,
      completedAt: new Date().toISOString(),
    });
    // A final retry lets Cloudflare route the poison message into the configured DLQ.
    message.retry();
  }
}

export default {
  async fetch(request: Request, env: CloudflareAsyncEnv) {
    const url = new URL(request.url);
    if (request.method !== "POST") {
      return new Response("Not found", { status: 404 });
    }

    if (url.pathname === "/render-invoice-pdf") {
      configureDocumentsRuntime(env);
      return renderInvoicePdf(request);
    }

    if (url.pathname === "/extract-statement-pdf") {
      configureDocumentsRuntime(env);
      return extractStatementPdf(request);
    }

    if (url.pathname !== "/queue-message") {
      return new Response("Not found", { status: 404 });
    }

    let payload: DocumentsQueueRequest;
    try {
      payload = (await request.json()) as DocumentsQueueRequest;
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    try {
      const result = await runDocumentsWorkerMessage(payload, env);
      return Response.json({ result });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("Documents worker message failed", {
        queueName: payload?.message?.queueName,
        jobName: payload?.message?.jobName,
        runId: payload?.message?.runId,
        error: message,
      });
      return Response.json({ error: message }, { status: 500 });
    }
  },

  async queue(batch: MessageBatch<CloudflareAsyncMessage>, env: CloudflareAsyncEnv) {
    configureDocumentsRuntime(env);

    if (batch.queue.includes("-dlq")) {
      const { handleDeadLetterQueueBatch } = await import("./dead-letter");
      await handleDeadLetterQueueBatch(batch, env);
      return;
    }

    const results = await Promise.allSettled(
      batch.messages.map((message) => processQueueMessage(message, env)),
    );

    const rejected = results.filter((result) => result.status === "rejected");
    if (rejected.length > 0) {
      logger.error("Documents queue batch had unhandled failures", { failed: rejected.length });
    }
  },
};
