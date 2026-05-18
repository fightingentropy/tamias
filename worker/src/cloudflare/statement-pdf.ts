import {
  PDF_STATEMENT_CSV_COLUMNS,
  PDF_STATEMENT_EXTRACTION_PROMPT,
  type ExtractedPdfStatement,
  extractedPdfStatementSchema,
  extractedTransactionsToCsvRows,
  extractRevolutStatementFromText,
} from "@tamias/import";
import { downloadVaultFile, uploadVaultFile } from "@tamias/storage";

const MAX_PDF_BYTES = 15 * 1024 * 1024;

export type StatementPdfErrorCode =
  | "NOT_FOUND"
  | "PAYLOAD_TOO_LARGE"
  | "PRECONDITION_FAILED"
  | "UNPROCESSABLE_CONTENT"
  | "INTERNAL_SERVER_ERROR";

export class StatementPdfExtractionError extends Error {
  readonly code: StatementPdfErrorCode;
  readonly status: number;

  constructor(status: number, code: StatementPdfErrorCode, message: string) {
    super(message);
    this.name = "StatementPdfExtractionError";
    this.code = code;
    this.status = status;
  }
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n") || value.includes("\r")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function rowsToCsv(columns: readonly string[], rows: Record<string, string>[]): string {
  const header = columns.map(csvEscape).join(",");
  const body = rows
    .map((row) => columns.map((col) => csvEscape(row[col] ?? "")).join(","))
    .join("\n");
  return body ? `${header}\n${body}\n` : `${header}\n`;
}

function deriveCsvPath(pdfPath: string[]): string[] {
  if (pdfPath.length === 0) {
    throw new Error("pdfPath must not be empty");
  }
  const filename = pdfPath[pdfPath.length - 1] ?? "statement.pdf";
  const stem = filename.replace(/\.pdf$/i, "");
  const csvName = `${stem}.extracted.csv`;
  return [...pdfPath.slice(0, -1), csvName];
}

export type ExtractStatementPdfResult = {
  csvFilePath: string[];
  columns: string[];
  rows: Record<string, string>[];
  detectedCurrency: string | null;
  transactionCount: number;
};

async function extractWithOpenAi({
  pdfBytes,
  filename,
}: {
  pdfBytes: Uint8Array;
  filename: string;
}): Promise<ExtractedPdfStatement> {
  const [{ openai }, { generateObject }] = await Promise.all([
    import("@ai-sdk/openai"),
    import("ai"),
  ]);

  const result = await generateObject({
    model: openai("gpt-5-mini"),
    schema: extractedPdfStatementSchema,
    abortSignal: AbortSignal.timeout(120_000),
    messages: [
      {
        role: "system",
        content: PDF_STATEMENT_EXTRACTION_PROMPT,
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Extract every transaction from the attached statement PDF.",
          },
          {
            type: "file",
            data: pdfBytes,
            mediaType: "application/pdf",
            filename,
          },
        ],
      },
    ],
  });

  return result.object;
}

async function extractTextFromPdfBytes(pdfBytes: Uint8Array): Promise<string | null> {
  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const doc = await getDocumentProxy(pdfBytes);
    const { text } = await extractText(doc, { mergePages: true });
    return Array.isArray(text) ? text.join("\n") : text;
  } catch (error) {
    console.warn("Could not extract text from PDF statement", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function extractKnownStatementFormat(
  pdfBytes: Uint8Array,
): Promise<ExtractedPdfStatement | null> {
  const text = await extractTextFromPdfBytes(pdfBytes);
  if (!text?.trim()) {
    return null;
  }

  return extractRevolutStatementFromText(text);
}

function hasExtractedTransactions(extracted: ExtractedPdfStatement | null | undefined): boolean {
  return (extracted?.transactions?.length ?? 0) > 0;
}

function hasOpenAiKey() {
  return !!process.env.OPENAI_API_KEY;
}

export async function extractStatementPdfInDocumentsWorker({
  pdfPath,
}: {
  pdfPath: string[];
}): Promise<ExtractStatementPdfResult> {
  const { data: blob, error: downloadError } = await downloadVaultFile(pdfPath);

  if (downloadError || !blob) {
    throw new StatementPdfExtractionError(
      404,
      "NOT_FOUND",
      "Could not read the uploaded statement.",
    );
  }

  if (blob.size > MAX_PDF_BYTES) {
    throw new StatementPdfExtractionError(
      413,
      "PAYLOAD_TOO_LARGE",
      `Statement is too large. Maximum size is ${MAX_PDF_BYTES / (1024 * 1024)} MB.`,
    );
  }

  const arrayBuffer = await blob.arrayBuffer();
  const pdfBytes = new Uint8Array(arrayBuffer);
  const filename = pdfPath[pdfPath.length - 1] ?? "statement.pdf";

  let extracted = await extractKnownStatementFormat(pdfBytes);

  if (!hasExtractedTransactions(extracted)) {
    if (!hasOpenAiKey()) {
      throw new StatementPdfExtractionError(
        412,
        "PRECONDITION_FAILED",
        "PDF statement extraction is not configured. Set OPENAI_API_KEY.",
      );
    }

    const failures: Array<{ via: string; error: string }> = [];

    try {
      const openAiExtracted = await extractWithOpenAi({ pdfBytes, filename });
      if (hasExtractedTransactions(openAiExtracted)) {
        extracted = openAiExtracted;
      } else {
        failures.push({ via: "openai", error: "No transactions detected" });
      }
    } catch (error) {
      failures.push({
        via: "openai",
        error: error instanceof Error ? error.message : String(error),
      });
    }

    if (!hasExtractedTransactions(extracted)) {
      console.error("PDF statement extraction failed", { failures });
      throw new StatementPdfExtractionError(
        500,
        "INTERNAL_SERVER_ERROR",
        "Could not extract transactions from this statement. Try a clearer PDF or CSV.",
      );
    }
  }

  if (!extracted?.transactions || extracted.transactions.length === 0) {
    throw new StatementPdfExtractionError(
      422,
      "UNPROCESSABLE_CONTENT",
      "No transactions were detected. Please upload a recognised bank or credit-card statement.",
    );
  }

  const rows = extractedTransactionsToCsvRows(extracted.transactions);
  const columns = [...PDF_STATEMENT_CSV_COLUMNS];
  const csvContent = rowsToCsv(columns, rows);
  const csvBlob = new Blob([csvContent], { type: "text/csv" });

  const csvPath = deriveCsvPath(pdfPath);
  const { data: uploaded, error: uploadError } = await uploadVaultFile({
    path: csvPath,
    blob: csvBlob,
    contentType: "text/csv",
    size: csvBlob.size,
  });

  if (uploadError || !uploaded) {
    throw new StatementPdfExtractionError(
      500,
      "INTERNAL_SERVER_ERROR",
      "Could not store the extracted transactions.",
    );
  }

  return {
    csvFilePath: csvPath,
    columns,
    rows,
    detectedCurrency: extracted.detectedCurrency,
    transactionCount: extracted.transactions.length,
  };
}
