"use client";

import dynamic from "@/framework/dynamic";
import { InboxDetailsSheet } from "@/components/sheets/inbox-details-sheet";
import { TransactionCreateSheet } from "@/components/sheets/transaction-create-sheet";
import { TransactionEditSheet } from "@/components/sheets/transaction-edit-sheet";
import { useDocumentParams } from "@/hooks/use-document-params";
import { useTransactionParams } from "@/hooks/use-transaction-params";
import { useDeferredSheetMount } from "./global-sheet-mount";

const DocumentSheet = dynamic(
  () => import("@/components/sheets/document-sheet").then((mod) => mod.DocumentSheet),
  { ssr: false },
);

const TransactionSheet = dynamic(
  () => import("@/components/sheets/transaction-sheet").then((mod) => mod.TransactionSheet),
  { ssr: false },
);

function DocumentSheetMount() {
  const { params } = useDocumentParams();
  const shouldMount = useDeferredSheetMount(Boolean(params.filePath || params.documentId));

  return shouldMount ? <DocumentSheet /> : null;
}

function TransactionSheetMount() {
  const { transactionId } = useTransactionParams();
  const shouldMount = useDeferredSheetMount(Boolean(transactionId));

  return shouldMount ? <TransactionSheet /> : null;
}

export function GlobalTransactionSheets() {
  return (
    <>
      <TransactionSheetMount />
      <TransactionCreateSheet />
      <TransactionEditSheet />

      <DocumentSheetMount />
      <InboxDetailsSheet />
    </>
  );
}
