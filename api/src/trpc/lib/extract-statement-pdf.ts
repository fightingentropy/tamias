import { TRPCError } from "@trpc/server";
import { requireDocumentsWorkerRuntime } from "../../documents-worker/runtime";

export type ExtractStatementPdfResult = {
  csvFilePath: string[];
  columns: string[];
  rows: Record<string, string>[];
  detectedCurrency: string | null;
  transactionCount: number;
};

type DocumentsWorkerError = {
  code?: TRPCError["code"];
  error?: string;
};

function codeForStatus(status: number): TRPCError["code"] {
  if (status === 404) return "NOT_FOUND";
  if (status === 413) return "PAYLOAD_TOO_LARGE";
  if (status === 412) return "PRECONDITION_FAILED";
  if (status === 422) return "UNPROCESSABLE_CONTENT";
  return "INTERNAL_SERVER_ERROR";
}

export async function extractStatementPdf({
  pdfPath,
}: {
  pdfPath: string[];
}): Promise<ExtractStatementPdfResult> {
  let documentsWorker: ReturnType<typeof requireDocumentsWorkerRuntime>;
  try {
    documentsWorker = requireDocumentsWorkerRuntime();
  } catch (error) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: error instanceof Error ? error.message : "DOCUMENTS_WORKER is not configured.",
    });
  }

  const response = await documentsWorker.fetch(
    "https://documents-worker.local/extract-statement-pdf",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ pdfPath }),
    },
  );

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as DocumentsWorkerError | null;
    throw new TRPCError({
      code: payload?.code ?? codeForStatus(response.status),
      message:
        payload?.error ??
        "Could not extract transactions from this statement. Try a clearer PDF or CSV.",
    });
  }

  return (await response.json()) as ExtractStatementPdfResult;
}
