import type { AccountType } from "../../utils/account";

export type TrueLayerEnvironment = "sandbox" | "production";

export type TrueLayerTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
};

export type TrueLayerAuthUrlRequest = {
  state: string;
  /**
   * Optional comma-separated provider filter. Leave empty to show all providers
   * supported for the configured environment.
   */
  providers?: string;
};

export type TrueLayerExchangeRequest = {
  code: string;
};

export type TrueLayerExchangeResponse = TrueLayerTokens;

export type TrueLayerAccountApi = {
  account_id: string;
  account_type: string;
  display_name: string;
  currency: string;
  account_number?: {
    iban?: string | null;
    sort_code?: string | null;
    number?: string | null;
    swift_bic?: string | null;
  } | null;
  provider: {
    provider_id: string;
    display_name: string;
    logo_uri?: string | null;
  };
  update_timestamp?: string | null;
};

export type TrueLayerCardApi = {
  account_id: string;
  card_network: string;
  card_type: string;
  currency: string;
  display_name: string;
  partial_card_number: string;
  name_on_card?: string | null;
  valid_from?: string | null;
  valid_to?: string | null;
  update_timestamp?: string | null;
  provider: {
    provider_id: string;
    display_name: string;
    logo_uri?: string | null;
  };
};

export type TrueLayerBalanceApi = {
  currency: string;
  available: number;
  current: number;
  overdraft?: number | null;
  update_timestamp?: string | null;
};

export type TrueLayerCardBalanceApi = {
  currency: string;
  available: number;
  current: number;
  credit_limit?: number | null;
  last_statement_balance?: number | null;
  last_statement_date?: string | null;
  payment_due?: number | null;
  payment_due_date?: string | null;
  update_timestamp?: string | null;
};

export type TrueLayerTransactionApi = {
  transaction_id: string;
  timestamp: string;
  description: string;
  amount: number;
  currency: string;
  transaction_type: "DEBIT" | "CREDIT";
  transaction_category: string;
  transaction_classification: string[];
  merchant_name?: string | null;
  running_balance?: {
    currency: string;
    amount: number;
  } | null;
  meta?: Record<string, string | null> | null;
};

export type TrueLayerProviderApi = {
  provider_id: string;
  display_name: string;
  logo_url?: string | null;
  country?: string | null;
  scopes?: string[];
};

export type TrueLayerResponseEnvelope<T> = {
  results: T[];
  status: "Succeeded" | "Failed";
};

export type TrueLayerAccountKind = "account" | "card";

export type TransformAccountPayload = {
  account: TrueLayerAccountApi | TrueLayerCardApi;
  balance:
    | (TrueLayerBalanceApi & { __kind: "account" })
    | (TrueLayerCardBalanceApi & { __kind: "card" });
  kind: TrueLayerAccountKind;
};

export type TransformTransactionPayload = {
  transaction: TrueLayerTransactionApi;
  accountType: AccountType;
  kind: TrueLayerAccountKind;
};
