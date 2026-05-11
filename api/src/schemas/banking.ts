import { z } from "zod";

export const providerSchema = z.literal("truelayer");

export const accountTypeSchema = z.enum([
  "depository",
  "credit",
  "other_asset",
  "loan",
  "other_liability",
]);

export const truelayerAuthUrlSchema = z.object({
  institutionId: z.string(),
  reconnect: z.boolean().optional(),
  connectionId: z.string().optional(),
});

export const truelayerExchangeSchema = z.object({
  token: z.string(),
});

// Connection schemas
export const connectionStatusSchema = z.object({
  id: z.string().optional(),
  provider: providerSchema,
  accessToken: z.string().optional(),
});

export const deleteConnectionSchema = z.object({
  id: z.string(),
  provider: providerSchema,
  accessToken: z.string().optional(),
});

// Account schemas
export const getProviderAccountsSchema = z.object({
  provider: providerSchema,
  accessToken: z.string().optional(),
  institutionId: z.string().optional(),
  id: z.string().optional(),
});

export const getBalanceSchema = z.object({
  provider: providerSchema,
  accessToken: z.string().optional(),
  id: z.string(),
  accountType: accountTypeSchema.optional(),
});

// Transaction schemas
export const getProviderTransactionsSchema = z.object({
  provider: providerSchema,
  accountId: z.string(),
  accountType: accountTypeSchema,
  latest: z.boolean().optional(),
  accessToken: z.string().optional(),
});
