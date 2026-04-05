import {
  roundCurrency,
  type LedgerAccountType,
  UK_SYSTEM_LEDGER_ACCOUNTS,
} from "@tamias/compliance";

const ACCOUNT_CATALOG = new Map(
  UK_SYSTEM_LEDGER_ACCOUNTS.map((account) => [account.code, account]),
);

export function inferAccountType(accountCode: string): LedgerAccountType {
  const leadingDigit = accountCode.trim()[0];

  switch (leadingDigit) {
    case "1":
      return "asset";
    case "2":
      return "liability";
    case "3":
      return "equity";
    case "4":
      return "income";
    default:
      return "expense";
  }
}

export function describeAccount(accountCode: string) {
  const account = ACCOUNT_CATALOG.get(accountCode);

  return {
    accountName: account?.name ?? `Account ${accountCode}`,
    accountType: account?.type ?? inferAccountType(accountCode),
  };
}

export function presentBalance(accountType: LedgerAccountType, balance: number) {
  switch (accountType) {
    case "liability":
    case "equity":
    case "income":
      return roundCurrency(balance * -1);
    default:
      return roundCurrency(balance);
  }
}
