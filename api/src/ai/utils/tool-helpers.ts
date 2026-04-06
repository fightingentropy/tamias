import type { AppContext } from "../agents/config/shared";

export function checkBankAccountsRequired(appContext: AppContext): {
  hasBankAccounts: boolean;
  shouldYield: boolean;
} {
  const hasBankAccounts = appContext.hasBankAccounts ?? false;
  return {
    hasBankAccounts,
    shouldYield: !hasBankAccounts,
  };
}
