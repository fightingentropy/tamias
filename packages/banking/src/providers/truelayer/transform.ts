import { capitalCase } from "change-case";
import type {
  Account as BaseAccount,
  GetAccountBalanceResponse,
  Transaction as BaseTransaction,
} from "../../types";
import { type AccountType, getType } from "../../utils/account";
import { getLogoURL } from "../../utils/logo";
import type {
  TrueLayerAccountApi,
  TrueLayerBalanceApi,
  TrueLayerCardApi,
  TrueLayerCardBalanceApi,
  TrueLayerProviderApi,
  TrueLayerTransactionApi,
} from "./types";

function toAccountType(input: string | undefined, kind: "account" | "card"): AccountType {
  if (kind === "card") return "credit";
  const normalized = input?.toLowerCase() ?? "";
  if (normalized.includes("credit")) return "credit";
  if (normalized.includes("loan") || normalized.includes("mortgage")) return "loan";
  return getType("depository");
}

function mapCategory(
  transaction: TrueLayerTransactionApi,
  accountType: AccountType,
): string | null {
  const classes = (transaction.transaction_classification ?? []).map((c) => c.toLowerCase());
  const merged = classes.join(" ");
  const primary = transaction.transaction_category?.toLowerCase() ?? "";

  if (primary === "transfer" || primary === "credit" || primary === "direct_credit") {
    if (accountType === "credit") return "credit-card-payment";
    if (transaction.transaction_type === "CREDIT") return "income";
  }

  if (primary === "direct_debit" || primary === "purchase" || primary === "atm") {
    // fall through to classification-based rules
  }

  if (merged.includes("food") || merged.includes("restaurant") || merged.includes("groceries")) {
    return "meals";
  }
  if (merged.includes("transport") || merged.includes("travel")) {
    return "travel";
  }
  if (merged.includes("utilities") || merged.includes("bills")) {
    return "utilities";
  }
  if (merged.includes("rent")) {
    return "rent";
  }
  if (merged.includes("internet") || merged.includes("phone") || merged.includes("telephone")) {
    return "internet-and-telephone";
  }
  if (merged.includes("insurance")) {
    return "insurance";
  }
  if (merged.includes("entertainment")) {
    return "activity";
  }
  if (merged.includes("tax")) {
    return "taxes";
  }
  if (merged.includes("health") || merged.includes("medical")) {
    return "benefits";
  }

  if (transaction.transaction_type === "CREDIT" && accountType !== "credit") {
    return "income";
  }

  return null;
}

function mapMethod(category: string | undefined): string {
  switch ((category ?? "").toLowerCase()) {
    case "atm":
      return "card_atm";
    case "direct_debit":
      return "payment";
    case "purchase":
      return "card_purchase";
    case "transfer":
      return "transfer";
    case "interest":
      return "interest";
    case "fee":
      return "fee";
    default:
      return "other";
  }
}

export function transformTransaction({
  transaction,
  accountType,
  kind,
}: {
  transaction: TrueLayerTransactionApi;
  accountType: AccountType;
  kind: "account" | "card";
}): BaseTransaction {
  // TrueLayer amounts: positive = CREDIT (money in), negative = DEBIT.
  // Internal convention: positive when money moves out of the account;
  // negative when money moves in. Apply the same inversion.
  const amount = +(transaction.amount * -1);

  const name = capitalCase(transaction.description ?? "");
  const merchant = transaction.merchant_name ?? null;
  const description = merchant && merchant !== name ? merchant : null;

  return {
    id: transaction.transaction_id,
    date: transaction.timestamp.slice(0, 10),
    name,
    description,
    currency_rate: null,
    currency_source: null,
    method: mapMethod(transaction.transaction_category),
    amount,
    currency: (transaction.currency ?? "GBP").toUpperCase(),
    category: mapCategory(transaction, accountType),
    counterparty_name: merchant ? capitalCase(merchant) : null,
    merchant_name: merchant,
    balance:
      typeof transaction.running_balance?.amount === "number"
        ? transaction.running_balance.amount
        : null,
    status: "posted",
  };
}

export function transformAccountBalance({
  balance,
  accountType,
}: {
  balance: TrueLayerBalanceApi | TrueLayerCardBalanceApi;
  accountType: AccountType;
}): GetAccountBalanceResponse {
  const amount =
    accountType === "credit" ? (balance.current ?? 0) : (balance.available ?? balance.current ?? 0);

  return {
    currency: (balance.currency ?? "GBP").toUpperCase(),
    amount,
    available_balance: balance.available ?? null,
    credit_limit: "credit_limit" in balance ? (balance.credit_limit ?? null) : null,
  };
}

export function transformAccount({
  account,
  balance,
  kind,
}: {
  account: TrueLayerAccountApi | TrueLayerCardApi;
  balance: TrueLayerBalanceApi | TrueLayerCardBalanceApi;
  kind: "account" | "card";
}): BaseAccount {
  const accountType = toAccountType(
    kind === "account"
      ? (account as TrueLayerAccountApi).account_type
      : (account as TrueLayerCardApi).card_type,
    kind,
  );

  const iban = kind === "account" ? (account as TrueLayerAccountApi).account_number?.iban : null;
  const sortCode =
    kind === "account" ? (account as TrueLayerAccountApi).account_number?.sort_code : null;
  const accountNumber =
    kind === "account" ? (account as TrueLayerAccountApi).account_number?.number : null;
  const bic =
    kind === "account" ? (account as TrueLayerAccountApi).account_number?.swift_bic : null;
  const mask = kind === "card" ? (account as TrueLayerCardApi).partial_card_number : null;

  return {
    id: account.account_id,
    name: account.display_name,
    currency: (account.currency ?? "GBP").toUpperCase(),
    type: accountType,
    institution: {
      id: account.provider.provider_id,
      name: account.provider.display_name,
      logo: getLogoURL(account.provider.provider_id),
      provider: "truelayer",
    },
    balance: transformAccountBalance({ balance, accountType }),
    resource_id: mask ?? iban ?? accountNumber ?? null,
    expires_at: null,
    iban: iban ?? null,
    subtype:
      kind === "card"
        ? ((account as TrueLayerCardApi).card_type ?? null)
        : ((account as TrueLayerAccountApi).account_type ?? null),
    bic: bic ?? null,
    routing_number: null,
    wire_routing_number: null,
    account_number: accountNumber ?? null,
    sort_code: sortCode ?? null,
    available_balance: balance.available ?? null,
    credit_limit: "credit_limit" in balance ? (balance.credit_limit ?? null) : null,
  };
}

export function transformInstitution(provider: TrueLayerProviderApi) {
  return {
    id: provider.provider_id,
    name: provider.display_name,
    logo: provider.logo_url ?? null,
    provider: "truelayer" as const,
  };
}
