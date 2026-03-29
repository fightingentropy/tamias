import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";
import { parseOfficeAsync } from "officeparser";
import { cleanText, extractTextFromRtf } from "../utils";
import { retryCall } from "../utils/retry";

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY!,
});

export async function loadDocument({
  content,
  metadata,
}: {
  content: Blob;
  metadata: { mimetype: string };
}) {
  let document: string | null = null;

  switch (metadata.mimetype) {
    case "application/pdf":
    case "application/x-pdf": {
      if (!google) {
        throw new Error(
          "GOOGLE_GENERATIVE_AI_API_KEY environment variable is required for PDF extraction",
        );
      }

      try {
        const arrayBuffer = await content.arrayBuffer();
        const base64Content = Buffer.from(arrayBuffer).toString("base64");
        const dataUri = `data:application/pdf;base64,${base64Content}`;

        // Use retry logic to handle transient failures (503 errors, timeouts)
        const result = await retryCall(
          () =>
            generateText({
              model: google("gemini-3-flash-preview"),
              abortSignal: AbortSignal.timeout(60000), // 60s timeout for PDF extraction
              messages: [
                {
                  role: "user",
                  content: [
                    {
                      type: "text",
                      text: "Extract all text from this PDF document. Return only the extracted text, preserving the structure and formatting as much as possible.",
                    },
                    {
                      type: "file",
                      data: dataUri,
                      mediaType: "application/pdf",
                    },
                  ],
                },
              ],
            }),
          2, // 2 retries (3 total attempts)
          2000, // Start with 2s delay
        );

        document = result.text ?? null;
      } catch (error) {
        // Log detailed error information for debugging
        const errorDetails: Record<string, unknown> = {
          error: error instanceof Error ? error.message : String(error),
          errorName: error instanceof Error ? error.name : typeof error,
        };
        if (error instanceof Error && error.stack) {
          errorDetails.errorStack = error.stack;
        }
        console.error(
          "Gemini PDF extraction failed after retries:",
          errorDetails,
        );
        // Return null instead of throwing to allow the process to continue
        // The upstream code will handle null documents appropriately
        document = null;
      }

      break;
    }

    case "text/csv": {
      document = await content.text();
      break;
    }

    case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
    case "application/vnd.oasis.opendocument.text":
    case "application/vnd.oasis.opendocument.spreadsheet":
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    case "application/msword":
    case "application/vnd.ms-excel":
    case "application/vnd.oasis.opendocument.presentation":
    case "application/docx": {
      const arrayBuffer = await content.arrayBuffer();
      const result = await parseOfficeAsync(Buffer.from(arrayBuffer));

      document = result;
      break;
    }

    case "text/markdown":
    case "text/plain": {
      document = await content.text();
      break;
    }

    case "application/rtf": {
      const arrayBuffer = await content.arrayBuffer();
      const text = extractTextFromRtf(Buffer.from(arrayBuffer));

      document = text;
      break;
    }

    case "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    case "application/pptx": {
      const arrayBuffer = await content.arrayBuffer();
      document = await parseOfficeAsync(Buffer.from(arrayBuffer));
      break;
    }

    default: {
      throw new Error(`Unsupported file type: ${metadata.mimetype}`);
    }
  }

  return document ? cleanText(document) : null;
}
