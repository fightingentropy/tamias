import { cn } from "@tamias/ui/cn";
import { Spinner } from "@tamias/ui/spinner";
import { stripSpecialCharacters } from "@tamias/utils";
import { useMutation } from "@tanstack/react-query";
import Papa from "papaparse";
import { useCallback, useEffect, useRef, useState } from "react";
import Dropzone, { type FileRejection } from "react-dropzone";
import { Controller } from "react-hook-form";
import { useUpload } from "@/hooks/use-upload";
import { useUserQuery } from "@/hooks/use-user";
import { useTRPC } from "@/trpc/client";
import { useCsvContext } from "./context";
import { getBalanceFromLatestDate } from "./field-mapping.utils";
import { readLines } from "./utils";

const PDF_PREVIEW_ROWS = 4;

function isPdfFile(file: File): boolean {
  if (file.type === "application/pdf" || file.type === "application/x-pdf") {
    return true;
  }
  return file.name.toLowerCase().endsWith(".pdf");
}

export function SelectFile() {
  const { watch, control, setFileColumns, setFirstRows, setExtractedPdf, setValue } =
    useCsvContext();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState<string>("Loading...");
  const processingRef = useRef<string | null>(null);

  const file = watch("file");

  const trpc = useTRPC();
  const { uploadFile } = useUpload();
  const { data: user } = useUserQuery();
  const { mutateAsync: extractStatementPdf } = useMutation(
    trpc.transactions.extractStatementPdf.mutationOptions(),
  );

  const processCsv = useCallback(
    async (fileToProcess: File) => {
      setLoadingLabel("Loading...");
      setIsLoading(true);
      const lines = await readLines(fileToProcess, 4);
      const { data, meta } = Papa.parse(lines, {
        worker: false,
        skipEmptyLines: true,
        header: true,
      });

      if (!data || data.length < 2) {
        setError("CSV file must have at least 2 rows.");
        setFileColumns(null);
        setFirstRows(null);
        setIsLoading(false);
        return;
      }

      if (!meta || !meta.fields || meta.fields.length <= 1) {
        setError("Failed to retrieve CSV column data.");
        setFileColumns(null);
        setFirstRows(null);
        setIsLoading(false);
        return;
      }

      setExtractedPdf(null);
      setFileColumns(meta.fields);
      // @ts-expect-error
      setFirstRows(data);
      setIsLoading(false);
    },
    [setFileColumns, setFirstRows, setExtractedPdf],
  );

  const processPdf = useCallback(
    async (fileToProcess: File) => {
      const teamId = user?.team?.id;
      if (!teamId) {
        setError("You need to be signed in to a team to import a statement.");
        setIsLoading(false);
        return;
      }

      setLoadingLabel("Uploading...");
      setIsLoading(true);
      const filename = stripSpecialCharacters(fileToProcess.name);
      const { path } = await uploadFile({
        bucket: "vault",
        path: [teamId, "imports", filename],
        file: fileToProcess,
      });

      setLoadingLabel("Reading statement...");
      const result = await extractStatementPdf({ filePath: path });

      const previewRows = result.rows.slice(0, PDF_PREVIEW_ROWS);

      setFileColumns(result.columns);
      setFirstRows(previewRows);
      setExtractedPdf({
        csvFilePath: result.csvFilePath,
        rowCount: result.transactionCount,
        detectedCurrency: result.detectedCurrency,
        currentBalance: getBalanceFromLatestDate(result.rows, "date", "balance"),
      });

      // Pre-fill mappings since the extracted CSV uses fixed column names.
      setValue("date", "date", { shouldValidate: true });
      setValue("description", "description", { shouldValidate: true });
      setValue("counterparty", "counterparty", { shouldValidate: true });
      setValue("amount", "amount", { shouldValidate: true });
      setValue("balance", "balance", { shouldValidate: true });
      if (result.detectedCurrency) {
        setValue("currency", result.detectedCurrency, { shouldValidate: true });
      }

      setIsLoading(false);
    },
    [
      uploadFile,
      extractStatementPdf,
      user?.team?.id,
      setFileColumns,
      setFirstRows,
      setExtractedPdf,
      setValue,
    ],
  );

  const processFile = useCallback(
    async (fileToProcess: File) => {
      // Prevent duplicate processing of the same file
      const fileKey = `${fileToProcess.name}-${fileToProcess.size}-${fileToProcess.lastModified}`;
      if (processingRef.current === fileKey) {
        return;
      }

      if (!fileToProcess) {
        setFileColumns(null);
        return;
      }

      processingRef.current = fileKey;
      setError(null);
      // Clear old preview data early so remapping only uses the latest file.
      setFileColumns(null);
      setFirstRows(null);
      setExtractedPdf(null);

      try {
        if (isPdfFile(fileToProcess)) {
          await processPdf(fileToProcess);
        } else {
          await processCsv(fileToProcess);
        }
      } catch (err) {
        console.error("Error processing file:", err);
        const message =
          err instanceof Error && err.message
            ? err.message
            : isPdfFile(fileToProcess)
              ? "Failed to read this PDF statement."
              : "Failed to read CSV file.";
        setError(message);
        setFileColumns(null);
        setFirstRows(null);
        setExtractedPdf(null);
        setIsLoading(false);
      } finally {
        processingRef.current = null;
      }
    },
    [processCsv, processPdf, setFileColumns, setFirstRows, setExtractedPdf],
  );

  useEffect(() => {
    if (file) {
      processFile(file);
    }
  }, [file, processFile]);

  return (
    <div className="flex flex-col gap-3">
      <Controller
        control={control}
        name="file"
        render={({ field: { onChange, onBlur } }) => (
          <Dropzone
            onDrop={(acceptedFiles) => {
              const file = acceptedFiles[0];
              if (file) {
                onChange(file);
                // Process file immediately to avoid waiting for watch to update
                processFile(file);
              }
            }}
            onDropRejected={(fileRejections: FileRejection[]) => {
              const rejection = fileRejections[0];
              if (rejection) {
                const error = rejection.errors[0];
                if (error?.code === "file-invalid-type") {
                  setError("Please select a CSV or PDF file.");
                } else if (error?.code === "file-too-large") {
                  setError("File size exceeds 15MB limit.");
                } else {
                  setError("File rejected. Please try again.");
                }
                console.error("File rejected:", rejection.errors);
              }
            }}
            maxFiles={1}
            accept={{
              "text/csv": [".csv"],
              "application/csv": [".csv"],
              "text/plain": [".csv"],
              "application/vnd.ms-excel": [".csv"],
              "application/pdf": [".pdf"],
              "application/x-pdf": [".pdf"],
            }}
            maxSize={15_000_000}
          >
            {({ getRootProps, getInputProps, isDragActive, isDragReject }) => (
              <div
                {...getRootProps()}
                className={cn(
                  "w-full border border-dashed h-[200px] mt-8 mb-8 flex items-center justify-center",
                  isDragActive && "bg-secondary text-primary",
                  isDragReject && "border-destructive",
                )}
              >
                <div className="text-center flex items-center justify-center flex-col text-xs text-[#878787]">
                  <input {...getInputProps()} onBlur={onBlur} />

                  {isLoading ? (
                    <div className="flex space-x-1 items-center">
                      <Spinner />
                      <span>{loadingLabel}</span>
                    </div>
                  ) : (
                    <div>
                      <p>Drop your file here, or click to browse.</p>
                      <span>15MB file limit. </span>
                      <span className="mt-2 text-[10px]">CSV or PDF statement</span>
                    </div>
                  )}

                  {error && <p className="text-center text-sm text-red-600 mt-4">{error}</p>}
                </div>
              </div>
            )}
          </Dropzone>
        )}
      />
    </div>
  );
}
