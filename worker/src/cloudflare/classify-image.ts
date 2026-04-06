import { limitWords, mapLanguageCodeToSearchConfig } from "@tamias/documents";
import { DocumentClassifier } from "@tamias/documents/classifier";
import { createLoggerWithContext } from "@tamias/logger";
import { downloadVaultFile } from "@tamias/storage";
import type { ClassifyImagePayload } from "../schemas/documents";
import { getDb } from "../utils/db";
import { updateDocumentWithRetry } from "../utils/document-update";
import { NonRetryableError } from "../utils/error-classification";
import { resizeImage } from "../utils/image-processing";
import { TIMEOUTS, withTimeout } from "../utils/timeout";
import type { CloudflareAsyncMessage } from "./bridge-helpers";

type CloudflareClassifyImageEnv = {
  CAPTURE_QUEUE?: Queue<CloudflareAsyncMessage>;
};

interface ImageClassificationResult {
  title: string | null;
  summary: string | null;
  content: string | null;
  date: string | null;
  language: string | null;
  tags: string[] | null;
}

const logger = createLoggerWithContext("worker:cloudflare:classify-image");

export async function runCloudflareClassifyImage(
  env: CloudflareClassifyImageEnv,
  payload: ClassifyImagePayload,
) {
  const { teamId, fileName } = payload;
  const db = getDb();
  const pathTokens = fileName.split("/");

  logger.info("Classifying image via Cloudflare worker", {
    fileName,
    teamId,
  });

  const { data: fileData } = await withTimeout(
    downloadVaultFile(fileName),
    TIMEOUTS.FILE_DOWNLOAD,
    `File download timed out after ${TIMEOUTS.FILE_DOWNLOAD}ms`,
  );

  if (!fileData) {
    throw new NonRetryableError("File not found", undefined, "validation");
  }

  const rawImageContent = await fileData.arrayBuffer();
  const { buffer: imageContent } = await resizeImage(
    rawImageContent,
    fileData.type || "image/jpeg",
    logger,
  );

  let classificationResult: ImageClassificationResult | null = null;
  let classificationFailed = false;

  try {
    const classifier = new DocumentClassifier();
    const arrayBuffer = new Uint8Array(imageContent).buffer;
    classificationResult = await withTimeout(
      classifier.classifyImage({ content: arrayBuffer }),
      TIMEOUTS.AI_CLASSIFICATION,
      `Image classification timed out after ${TIMEOUTS.AI_CLASSIFICATION}ms`,
    );
  } catch (error) {
    classificationFailed = true;
    logger.warn("AI image classification failed, completing with fallback", {
      fileName,
      teamId,
      error: error instanceof Error ? error.message : "Unknown error",
      errorType: error instanceof Error ? error.name : "Unknown",
    });
  }

  let finalTitle: string | null = null;

  if (classificationResult?.title && classificationResult.title.trim().length > 0) {
    finalTitle = classificationResult.title;
  } else if (classificationResult && !classificationFailed) {
    const fileNameWithoutExt =
      fileName
        .split("/")
        .pop()
        ?.replace(/\.[^/.]+$/, "") || "Image";
    const datePart = classificationResult.date ? ` - ${classificationResult.date}` : "";
    const summaryPart = classificationResult.summary
      ? ` - ${classificationResult.summary.substring(0, 50)}${classificationResult.summary.length > 50 ? "..." : ""}`
      : "";
    const contentSample = (
      classificationResult.content ||
      classificationResult.summary ||
      ""
    ).toLowerCase();

    let inferredType = "Image";
    if (contentSample.includes("receipt")) {
      inferredType = "Receipt";
    } else if (contentSample.includes("invoice") || contentSample.includes("inv")) {
      inferredType = "Invoice";
    } else if (contentSample.includes("logo")) {
      inferredType = "Logo";
    } else if (contentSample.includes("photo")) {
      inferredType = "Photo";
    }

    finalTitle = `${inferredType}${summaryPart || ` - ${fileNameWithoutExt}`}${datePart}`;
  }

  const updatedDocs = await updateDocumentWithRetry(
    db,
    {
      pathTokens,
      teamId,
      title: finalTitle ?? undefined,
      summary: classificationResult?.summary ?? undefined,
      content: classificationResult?.content
        ? limitWords(classificationResult.content, 10000)
        : undefined,
      date: classificationResult?.date ?? undefined,
      language: mapLanguageCodeToSearchConfig(classificationResult?.language),
      processingStatus: "completed",
    },
    logger,
  );

  if (!updatedDocs || updatedDocs.length === 0) {
    throw new Error(`Document with path ${fileName} not found`);
  }

  const data = updatedDocs[0];
  if (!data?.id) {
    throw new Error(`Document update returned invalid data for path ${fileName}`);
  }

  if (classificationResult?.tags && classificationResult.tags.length > 0 && env.CAPTURE_QUEUE) {
    await env.CAPTURE_QUEUE.send(
      {
        queue: "capture",
        queueName: "documents",
        jobName: "embed-document-tags",
        payload: {
          documentId: data.id,
          tags: classificationResult.tags,
          teamId,
        },
        maxAttempts: 4,
      },
      {
        contentType: "json",
      },
    );
  }

  return {
    documentId: data.id,
    classificationFailed,
    hasTitle: !!finalTitle,
  };
}
