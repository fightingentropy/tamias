"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { useCategoryParams } from "@/hooks/use-category-params";
import { useConnectParams } from "@/hooks/use-connect-params";
import { useCustomerParams } from "@/hooks/use-customer-params";
import { useDocumentParams } from "@/hooks/use-document-params";
import { useInboxParams } from "@/hooks/use-inbox-params";
import { useInvoiceParams } from "@/hooks/use-invoice-params";
import { useProductParams } from "@/hooks/use-product-params";
import { useTrackerParams } from "@/hooks/use-tracker-params";
import { useTransactionParams } from "@/hooks/use-transaction-params";
import { prefetchSearchModule } from "@/lib/search-module";
import { useSearchStore } from "@/store/search";

const GlobalSheets = dynamic(
  () => import("./global-sheets").then((mod) => mod.GlobalSheets),
  { ssr: false },
);

export function GlobalSheetsProvider() {
  const { isOpen: isSearchOpen, setOpen: toggleSearch } = useSearchStore();
  const customerParams = useCustomerParams();
  const categoryParams = useCategoryParams();
  const productParams = useProductParams();
  const transactionParams = useTransactionParams();
  const invoiceParams = useInvoiceParams();
  const trackerParams = useTrackerParams();
  const documentParams = useDocumentParams();
  const { params: inboxParams } = useInboxParams();
  const connectParams = useConnectParams();

  const hasOpenOverlay =
    isSearchOpen ||
    Boolean(customerParams.createCustomer) ||
    Boolean(customerParams.customerId) ||
    Boolean(categoryParams.createCategory) ||
    Boolean(categoryParams.categoryId) ||
    Boolean(productParams.createProduct) ||
    Boolean(productParams.productId) ||
    Boolean(transactionParams.transactionId) ||
    Boolean(transactionParams.createTransaction) ||
    Boolean(transactionParams.editTransaction) ||
    Boolean(invoiceParams.editRecurringId) ||
    invoiceParams.type === "create" ||
    invoiceParams.type === "edit" ||
    invoiceParams.type === "success" ||
    invoiceParams.type === "details" ||
    Boolean(
      documentParams.params.filePath || documentParams.params.documentId,
    ) ||
    Boolean(inboxParams.inboxId && inboxParams.type === "details") ||
    connectParams.step === "connect" ||
    connectParams.step === "account" ||
    connectParams.step === "import" ||
    Boolean(trackerParams.create) ||
    Boolean(trackerParams.update !== null && trackerParams.projectId) ||
    Boolean(
      !trackerParams.update &&
        !trackerParams.create &&
        (trackerParams.projectId ||
          (trackerParams.range?.length ?? 0) === 2 ||
          trackerParams.selectedDate ||
          trackerParams.eventId),
    );

  const [shouldLoadGlobalSheets, setShouldLoadGlobalSheets] =
    useState(hasOpenOverlay);

  useHotkeys(
    "meta+k",
    () => {
      prefetchSearchModule();
      toggleSearch();
    },
    {
      enableOnFormTags: true,
      enabled: !shouldLoadGlobalSheets,
    },
  );

  useEffect(() => {
    if (hasOpenOverlay) {
      setShouldLoadGlobalSheets(true);
    }
  }, [hasOpenOverlay]);

  return shouldLoadGlobalSheets ? <GlobalSheets /> : null;
}
