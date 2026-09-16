import { createHash } from "node:crypto";
import { upsertTransactions } from "@tamias/app-data/queries";
import { mapTransactions } from "@tamias/import/mappings";
import { addDuplicateDisambiguators, transform } from "@tamias/import/transform";
import { createTransactionSchema } from "@tamias/import/validate";
import { enqueue } from "@tamias/job-client";
import { downloadVaultFile } from "@tamias/storage";
import Papa from "papaparse";
import {
  importTransactionsSchema,
  type ImportTransactionsPayload,
} from "../../schemas/transactions";
import type { WorkerJob as Job } from "../../types/job";
import { getDb } from "../../utils/db";
import { TIMEOUTS, withTimeout } from "../../utils/timeout";
import { BaseProcessor } from "../base";

// Each batch runs in a separate queue invocation, including its ledger writes.
export const IMPORT_BATCH_SIZE = 50;

export function prepareTransactionImportBatch(content: string, data: ImportTransactionsPayload) {
  const sourceHash = createHash("sha256").update(content).digest("hex");
  if (data.cursor && data.cursor.sourceHash !== sourceHash) {
    throw new Error("The import file changed. Start a new import to continue.");
  }

  const parsed = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: "greedy",
  });
  if (parsed.errors.length > 0) {
    throw new Error(`Invalid CSV: ${parsed.errors[0]?.message}`);
  }
  if (parsed.data.length === 0) {
    throw new Error("No transactions found in the import file");
  }

  // Disambiguate across the whole file before slicing, so identical payments
  // on either side of a batch boundary retain distinct, stable import IDs.
  const mapped = mapTransactions(
    parsed.data,
    data.mappings,
    data.currency,
    data.teamId,
    data.bankAccountId,
  );
  const validated = addDuplicateDisambiguators({
    transactions: mapped,
    inverted: data.inverted,
  }).map((transaction) =>
    createTransactionSchema.safeParse(transform({ transaction, inverted: data.inverted })),
  );
  const valid = validated.flatMap((result) => (result.success ? [result.data] : []));
  const offset = data.cursor?.offset ?? 0;
  if (offset > valid.length || (data.cursor?.importedCount ?? 0) > offset) {
    throw new Error("Invalid import continuation");
  }

  return {
    transactions: valid.slice(offset, offset + IMPORT_BATCH_SIZE),
    sourceHash,
    offset,
    totalCount: valid.length,
    invalidCount: validated.length - valid.length,
  };
}

export type ImportTransactionsResult = {
  importedCount: number;
  skippedCount: number;
  invalidCount: number;
  continuation?: NonNullable<ImportTransactionsPayload["cursor"]>;
};

export class ImportTransactionsProcessor extends BaseProcessor<ImportTransactionsPayload> {
  protected getPayloadSchema() {
    return importTransactionsSchema;
  }

  async process(job: Job<ImportTransactionsPayload>): Promise<ImportTransactionsResult> {
    const { teamId, filePath } = job.data;
    if (!filePath?.length || filePath[0] !== teamId) {
      throw new Error("An import file belonging to this workspace is required");
    }

    const { data: fileData, error } = await withTimeout(
      downloadVaultFile(filePath),
      TIMEOUTS.FILE_DOWNLOAD,
      "File download timed out",
    );
    if (error) throw error;
    const content = await fileData?.text();
    if (!content) throw new Error("File content is required");

    const batch = prepareTransactionImportBatch(content, job.data);
    const upserted = await upsertTransactions(getDb(), {
      teamId,
      transactions: batch.transactions.map((t) => ({
        name: t.name,
        date: t.date,
        method: t.method === "card" ? "card_purchase" : t.method === "bank" ? "transfer" : "other",
        amount: t.amount,
        currency: t.currency,
        teamId: t.team_id,
        bankAccountId: t.bank_account_id,
        internalId: t.internal_id,
        status: t.status,
        manual: t.manual,
        categorySlug: t.category_slug,
        counterpartyName: t.counterparty_name,
        notified: true,
      })),
    });

    // Bound follow-up jobs too, including their queue payloads and database work.
    const transactionIds = upserted.map((t) => t.id);
    if (transactionIds.length > 0) {
      await enqueue("enrich-transactions", { transactionIds, teamId }, "transactions");
      await enqueue(
        "match-transactions-bidirectional",
        { teamId, newTransactionIds: transactionIds },
        "inbox",
      );
    }

    const nextOffset = batch.offset + batch.transactions.length;
    const importedCount = (job.data.cursor?.importedCount ?? 0) + transactionIds.length;
    const complete = nextOffset >= batch.totalCount;
    await this.updateProgress(
      job,
      complete ? 100 : 10 + Math.round((nextOffset / batch.totalCount) * 85),
      undefined,
      complete ? "completed" : "importing",
    );

    return {
      importedCount,
      skippedCount: nextOffset - importedCount,
      invalidCount: batch.invalidCount,
      ...(!complete
        ? { continuation: { offset: nextOffset, importedCount, sourceHash: batch.sourceHash } }
        : {}),
    };
  }
}
