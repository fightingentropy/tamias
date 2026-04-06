import { z } from "zod";

/**
 * Transaction job schemas
 */

const bankProviderSchema = z.enum(["teller", "plaid"]);
const bankAccountTypeSchema = z.enum([
  "credit",
  "other_asset",
  "other_liability",
  "depository",
  "loan",
]);

export const exportTransactionsSchema = z.object({
  teamId: z.string().uuid(),
  userId: z.string(),
  userEmail: z.string().email().optional(),
  locale: z.string(),
  dateFormat: z.string().nullable().optional(),
  transactionIds: z.array(z.string().uuid()),
  exportSettings: z
    .object({
      csvDelimiter: z.string(),
      includeCSV: z.boolean(),
      includeXLSX: z.boolean(),
      sendEmail: z.boolean(),
      sendCopyToMe: z.boolean().optional(),
      accountantEmail: z.string().optional(),
    })
    .optional(),
});

export type ExportTransactionsPayload = z.infer<typeof exportTransactionsSchema>;

export const processExportSchema = z.object({
  ids: z.array(z.string().uuid()),
  teamId: z.string().uuid(),
  locale: z.string(),
  dateFormat: z.string().nullable().optional(),
});

export type ProcessExportPayload = z.infer<typeof processExportSchema>;

export const processTransactionAttachmentSchema = z.object({
  transactionId: z.string().uuid(),
  mimetype: z.string(),
  filePath: z.array(z.string()),
  teamId: z.string().uuid(),
});

export type ProcessTransactionAttachmentPayload = z.infer<
  typeof processTransactionAttachmentSchema
>;

export const enrichTransactionsSchema = z.object({
  transactionIds: z.array(z.string().uuid()),
  teamId: z.string().uuid(),
});

export type EnrichTransactionsPayload = z.infer<typeof enrichTransactionsSchema>;

export const initialBankSetupSchema = z.object({
  teamId: z.string().uuid(),
  connectionId: z.string().uuid(),
});

export type InitialBankSetupPayload = z.infer<typeof initialBankSetupSchema>;

export const syncConnectionSchema = z.object({
  connectionId: z.string().uuid(),
  manualSync: z.boolean().optional(),
});

export type SyncConnectionPayload = z.infer<typeof syncConnectionSchema>;

export const transactionNotificationsSchema = z.object({
  teamId: z.string().uuid(),
});

export type TransactionNotificationsPayload = z.infer<typeof transactionNotificationsSchema>;

export const deleteConnectionSchema = z.object({
  referenceId: z.string().optional().nullable(),
  provider: bankProviderSchema,
  accessToken: z.string().optional().nullable(),
});

export type DeleteConnectionPayload = z.infer<typeof deleteConnectionSchema>;

export const importTransactionsSchema = z.object({
  inverted: z.boolean(),
  filePath: z.array(z.string()).optional(),
  bankAccountId: z.string(),
  currency: z.string(),
  teamId: z.string(),
  table: z.array(z.record(z.string(), z.string())).optional(),
  mappings: z
    .object({
      amount: z.string(),
      date: z.string(),
      description: z.string().optional(),
      counterparty: z.string().optional(),
      balance: z.string().optional(),
    })
    .refine((mappings) => !!mappings.description || !!mappings.counterparty, {
      message: "Either description or counterparty mapping is required",
      path: ["description"],
    }),
});

export type ImportTransactionsPayload = z.infer<typeof importTransactionsSchema>;

export const updateBaseCurrencySchema = z.object({
  teamId: z.string().uuid(),
  baseCurrency: z.string(),
});

export type UpdateBaseCurrencyPayload = z.infer<typeof updateBaseCurrencySchema>;

export const updateAccountBaseCurrencySchema = z.object({
  accountId: z.string().uuid(),
  currency: z.string(),
  balance: z.number(),
  baseCurrency: z.string(),
});

export type UpdateAccountBaseCurrencyPayload = z.infer<typeof updateAccountBaseCurrencySchema>;

export const reconnectConnectionSchema = z.object({
  teamId: z.string().uuid(),
  connectionId: z.string().uuid(),
  provider: bankProviderSchema,
});

export type ReconnectConnectionPayload = z.infer<typeof reconnectConnectionSchema>;

export type BankProvider = z.infer<typeof bankProviderSchema>;
export type BankAccountType = z.infer<typeof bankAccountTypeSchema>;

export const syncBankAccountSchema = z.object({
  id: z.string().uuid(),
  teamId: z.string().uuid(),
  accountId: z.string(),
  accessToken: z.string().optional(),
  errorRetries: z.number().optional(),
  provider: bankProviderSchema,
  manualSync: z.boolean().optional(),
  currency: z.string().optional(),
  accountType: bankAccountTypeSchema,
});

export type SyncBankAccountPayload = z.infer<typeof syncBankAccountSchema>;
