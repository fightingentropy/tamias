"use client";

import { ConnectTransactionsModal } from "@/components/modals/connect-transactions-modal";
import { ImportModal } from "@/components/modals/import-modal";
import { SelectBankAccountsModal } from "@/components/modals/select-bank-accounts";

export function GlobalConnectSheets() {
  return (
    <>
      <SelectBankAccountsModal />
      <ImportModal />
      <ConnectTransactionsModal />
    </>
  );
}
