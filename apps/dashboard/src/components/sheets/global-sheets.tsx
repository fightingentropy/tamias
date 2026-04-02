"use client";

import dynamic from "@/framework/dynamic";
import { useEffect, useState } from "react";
import { ConnectTransactionsModal } from "@/components/modals/connect-transactions-modal";
import { ImportModal } from "@/components/modals/import-modal";
import { SelectBankAccountsModal } from "@/components/modals/select-bank-accounts";
import { SearchModal } from "@/components/search/search-modal";
import { CategoryCreateSheet } from "@/components/sheets/category-create-sheet";
import { CategoryEditSheet } from "@/components/sheets/category-edit-sheet";
import { CustomerCreateSheet } from "@/components/sheets/customer-create-sheet";
import { CustomerEditSheet } from "@/components/sheets/customer-edit-sheet";
import { InboxDetailsSheet } from "@/components/sheets/inbox-details-sheet";
import { ProductCreateSheet } from "@/components/sheets/product-create-sheet";
import { ProductEditSheet } from "@/components/sheets/product-edit-sheet";
import { TrackerCreateSheet } from "@/components/sheets/tracker-create-sheet";
import { TrackerScheduleSheet } from "@/components/sheets/tracker-schedule-sheet";
import { TransactionCreateSheet } from "@/components/sheets/transaction-create-sheet";
import { TransactionEditSheet } from "@/components/sheets/transaction-edit-sheet";
import { useCustomerParams } from "@/hooks/use-customer-params";
import { useDocumentParams } from "@/hooks/use-document-params";
import { useInvoiceParams } from "@/hooks/use-invoice-params";
import { useTrackerParams } from "@/hooks/use-tracker-params";
import { useTransactionParams } from "@/hooks/use-transaction-params";

const CustomerDetailsSheet = dynamic(
  () =>
    import("@/components/sheets/customer-details-sheet").then(
      (mod) => mod.CustomerDetailsSheet,
    ),
  { ssr: false },
);

const DocumentSheet = dynamic(
  () => import("@/components/sheets/document-sheet").then((mod) => mod.DocumentSheet),
  { ssr: false },
);

const EditRecurringSheet = dynamic(
  () =>
    import("@/components/sheets/edit-recurring-sheet").then(
      (mod) => mod.EditRecurringSheet,
    ),
  { ssr: false },
);

const InvoiceDetailsSheet = dynamic(
  () =>
    import("@/components/sheets/invoice-details-sheet").then(
      (mod) => mod.InvoiceDetailsSheet,
    ),
  { ssr: false },
);

const InvoiceSheet = dynamic(
  () => import("@/components/sheets/invoice-sheet").then((mod) => mod.InvoiceSheet),
  { ssr: false },
);

const TrackerUpdateSheet = dynamic(
  () =>
    import("@/components/sheets/tracker-update-sheet").then(
      (mod) => mod.TrackerUpdateSheet,
    ),
  { ssr: false },
);

const TransactionSheet = dynamic(
  () =>
    import("@/components/sheets/transaction-sheet").then(
      (mod) => mod.TransactionSheet,
    ),
  { ssr: false },
);

function useDeferredSheetMount(isOpen: boolean) {
  const [shouldMount, setShouldMount] = useState(isOpen);

  useEffect(() => {
    if (isOpen) {
      setShouldMount(true);
    }
  }, [isOpen]);

  return shouldMount;
}

function CustomerDetailsSheetMount() {
  const { customerId, details } = useCustomerParams();
  const shouldMount = useDeferredSheetMount(Boolean(customerId && details));

  return shouldMount ? <CustomerDetailsSheet /> : null;
}

function DocumentSheetMount() {
  const { params } = useDocumentParams();
  const shouldMount = useDeferredSheetMount(
    Boolean(params.filePath || params.documentId),
  );

  return shouldMount ? <DocumentSheet /> : null;
}

function EditRecurringSheetMount() {
  const { editRecurringId } = useInvoiceParams();
  const shouldMount = useDeferredSheetMount(Boolean(editRecurringId));

  return shouldMount ? <EditRecurringSheet /> : null;
}

function InvoiceDetailsSheetMount() {
  const { invoiceId, type } = useInvoiceParams();
  const shouldMount = useDeferredSheetMount(Boolean(invoiceId && type === "details"));

  return shouldMount ? <InvoiceDetailsSheet /> : null;
}

function InvoiceSheetMount() {
  const { type } = useInvoiceParams();
  const shouldMount = useDeferredSheetMount(
    type === "create" || type === "edit" || type === "success",
  );

  return shouldMount ? <InvoiceSheet /> : null;
}

function TrackerUpdateSheetMount() {
  const { update, projectId } = useTrackerParams();
  const shouldMount = useDeferredSheetMount(update !== null && Boolean(projectId));

  return shouldMount ? <TrackerUpdateSheet /> : null;
}

function TransactionSheetMount() {
  const { transactionId } = useTransactionParams();
  const shouldMount = useDeferredSheetMount(Boolean(transactionId));

  return shouldMount ? <TransactionSheet /> : null;
}

export function GlobalSheets() {
  return (
    <>
      <TrackerUpdateSheetMount />
      <TrackerCreateSheet />
      <TrackerScheduleSheet />

      <CategoryCreateSheet />
      <CategoryEditSheet />

      <CustomerCreateSheet />
      <CustomerDetailsSheetMount />
      <CustomerEditSheet />

      <ProductCreateSheet />
      <ProductEditSheet />

      <TransactionSheetMount />
      <TransactionCreateSheet />
      <TransactionEditSheet />

      <SelectBankAccountsModal />

      <SearchModal />

      <DocumentSheetMount />
      <InboxDetailsSheet />

      <ImportModal />
      <ConnectTransactionsModal />

      <InvoiceDetailsSheetMount />
      <InvoiceSheetMount />
      <EditRecurringSheetMount />
    </>
  );
}
