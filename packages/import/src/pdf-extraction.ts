import { z } from "zod";

export const extractedPdfTransactionSchema = z.object({
  date: z
    .string()
    .describe(
      "Transaction posting date in ISO 8601 (YYYY-MM-DD). Use the posted/value date when both appear.",
    ),
  description: z
    .string()
    .describe("Raw transaction description, memo, or merchant text from the statement line."),
  counterparty: z
    .string()
    .nullable()
    .describe(
      "The other party to the transaction (merchant, payee, payer). Null when the description already names the counterparty or none is identifiable.",
    ),
  amount: z
    .number()
    .describe(
      "Signed amount in the statement currency. Negative for debits / withdrawals / payments, positive for credits / deposits.",
    ),
  balance: z
    .number()
    .nullable()
    .describe("Running balance after this transaction, when shown on the statement. Null otherwise."),
});

export type ExtractedPdfTransaction = z.infer<typeof extractedPdfTransactionSchema>;

export const extractedPdfStatementSchema = z.object({
  detectedCurrency: z
    .string()
    .nullable()
    .describe(
      "Three-letter ISO 4217 currency code for the statement (e.g. USD, GBP, EUR). Null if not determinable.",
    ),
  transactions: z
    .array(extractedPdfTransactionSchema)
    .describe(
      "Every transaction on the statement, in the order it appears. Do not skip or summarise.",
    ),
});

export type ExtractedPdfStatement = z.infer<typeof extractedPdfStatementSchema>;

export const PDF_STATEMENT_EXTRACTION_PROMPT = [
  "<role>",
  "You extract every transaction from a bank or credit-card statement PDF into a fixed JSON schema.",
  "</role>",
  "",
  "<rules>",
  "1) Return EVERY transaction line on the statement. Do not skip, summarise, or merge rows.",
  "2) Exclude opening balance, closing balance, total / subtotal lines, and section headers — only real transactions.",
  "3) Dates must be ISO 8601 (YYYY-MM-DD). Infer the year from the statement period if the line shows only month/day.",
  "4) `amount` is signed: negative for debits, withdrawals, card purchases, payments out; positive for credits, deposits, refunds, payments in.",
  "5) When the statement uses separate Debit / Credit columns, combine them into a single signed `amount`.",
  "6) `description` is the raw line text the bank shows (memo, merchant, narrative).",
  "7) `counterparty` is the merchant / payee / payer name when distinct from the description; otherwise null.",
  "8) `detectedCurrency` is the three-letter ISO 4217 code shown on the statement header / amounts (USD, GBP, EUR, …). Null if truly unknown.",
  "9) If the document is not a bank or credit-card statement, return an empty `transactions` array.",
  "</rules>",
  "",
  "<output_contract>",
  "Return only the structured object. No prose, no preamble.",
  "</output_contract>",
].join("\n");

export function extractedTransactionsToCsvRows(
  transactions: ExtractedPdfTransaction[],
): Record<string, string>[] {
  return transactions.map((t) => ({
    date: t.date,
    description: t.description,
    counterparty: t.counterparty ?? "",
    amount: Number.isFinite(t.amount) ? t.amount.toString() : "",
    balance: t.balance != null && Number.isFinite(t.balance) ? t.balance.toString() : "",
  }));
}

export const PDF_STATEMENT_CSV_COLUMNS = [
  "date",
  "description",
  "counterparty",
  "amount",
  "balance",
] as const;
