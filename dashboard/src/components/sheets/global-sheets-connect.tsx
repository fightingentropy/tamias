"use client";

import dynamic from "@/framework/dynamic";
import { useConnectParams } from "@/hooks/use-connect-params";

const ConnectTransactionsModal = dynamic(
  () =>
    import("@/components/modals/connect-transactions-modal").then(
      (mod) => mod.ConnectTransactionsModal,
    ),
  { ssr: false },
);

const ImportModal = dynamic(
  () => import("@/components/modals/import-modal").then((mod) => mod.ImportModal),
  { ssr: false },
);

const SelectBankAccountsModal = dynamic(
  () =>
    import("@/components/modals/select-bank-accounts").then(
      (mod) => mod.SelectBankAccountsModal,
    ),
  { ssr: false },
);

export function GlobalConnectSheets() {
  const { step } = useConnectParams();

  if (step === "account") {
    return <SelectBankAccountsModal />;
  }

  if (step === "import") {
    return <ImportModal />;
  }

  if (step === "connect") {
    return <ConnectTransactionsModal />;
  }

  return null;
}
