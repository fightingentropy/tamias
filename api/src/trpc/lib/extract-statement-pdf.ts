import {
  PDF_STATEMENT_CSV_COLUMNS,
  PDF_STATEMENT_EXTRACTION_PROMPT,
  type ExtractedPdfStatement,
  extractedPdfStatementSchema,
  extractedTransactionsToCsvRows,
} from "@tamias/import";
import { downloadVaultFile, uploadVaultFile } from "@tamias/storage";
import { TRPCError } from "@trpc/server";
import { extractStatementWithCodex, isCodexBridgeAvailable } from "./codex-bridge";

const MAX_PDF_BYTES = 15 * 1024 * 1024;

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

export async function extractStatementPdf({
  pdfPath,
}: {
  pdfPath: string[];
}): Promise<ExtractStatementPdfResult> {
  const codexAvailable = await isCodexBridgeAvailable();

  if (!codexAvailable && !process.env.OPENAI_API_KEY) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "PDF statement extraction is not configured. Sign in with `codex login` for local dev, or set OPENAI_API_KEY.",
    });
  }

  const { data: blob, error: downloadError } = await downloadVaultFile(pdfPath);

  if (downloadError || !blob) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Could not read the uploaded statement.",
    });
  }

  if (blob.size > MAX_PDF_BYTES) {
    throw new TRPCError({
      code: "PAYLOAD_TOO_LARGE",
      message: `Statement is too large. Maximum size is ${MAX_PDF_BYTES / (1024 * 1024)} MB.`,
    });
  }

  const arrayBuffer = await blob.arrayBuffer();
  const pdfBytes = new Uint8Array(arrayBuffer);
  const filename = pdfPath[pdfPath.length - 1] ?? "statement.pdf";

  let extracted: ExtractedPdfStatement;
  try {
    if (codexAvailable) {
      extracted = await extractStatementWithCodex({ pdfBytes });
    } else {
      extracted = await extractWithOpenAi({ pdfBytes, filename });
    }
  } catch (error) {
    console.error("PDF statement extraction failed", {
      via: codexAvailable ? "codex" : "openai",
      error: error instanceof Error ? error.message : String(error),
    });
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Could not extract transactions from this statement. Try a clearer PDF or CSV.",
    });
  }

  if (!extracted.transactions || extracted.transactions.length === 0) {
    throw new TRPCError({
      code: "UNPROCESSABLE_CONTENT",
      message:
        "No transactions were detected. Please upload a recognised bank or credit-card statement.",
    });
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
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Could not store the extracted transactions.",
    });
  }

  return {
    csvFilePath: csvPath,
    columns,
    rows,
    detectedCurrency: extracted.detectedCurrency,
    transactionCount: extracted.transactions.length,
  };
}
