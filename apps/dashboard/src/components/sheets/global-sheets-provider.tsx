"use client";

import dynamic from "@/framework/dynamic";
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

const GlobalConnectSheets = dynamic(
  () =>
    import("./global-sheets-connect").then((mod) => mod.GlobalConnectSheets),
  { ssr: false },
);

const GlobalEntitySheets = dynamic(
  () =>
    import("./global-sheets-entities").then((mod) => mod.GlobalEntitySheets),
  { ssr: false },
);

const GlobalInvoiceSheets = dynamic(
  () =>
    import("./global-sheets-invoices").then((mod) => mod.GlobalInvoiceSheets),
  { ssr: false },
);

const GlobalSearchSheets = dynamic(
  () => import("./global-sheets-search").then((mod) => mod.GlobalSearchSheets),
  { ssr: false },
);

const GlobalTrackerSheets = dynamic(
  () =>
    import("./global-sheets-tracker").then((mod) => mod.GlobalTrackerSheets),
  { ssr: false },
);

const GlobalTransactionSheets = dynamic(
  () =>
    import("./global-sheets-transactions").then(
      (mod) => mod.GlobalTransactionSheets,
    ),
  { ssr: false },
);

function useStickyOverlayMount(isOpen: boolean) {
  const [shouldMount, setShouldMount] = useState(isOpen);

  useEffect(() => {
    if (isOpen) {
      setShouldMount(true);
    }
  }, [isOpen]);

  return shouldMount;
}

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

  const hasOpenSearchSheets = isSearchOpen;

  const hasOpenEntitySheets =
    Boolean(customerParams.createCustomer) ||
    Boolean(customerParams.customerId) ||
    Boolean(categoryParams.createCategory) ||
    Boolean(categoryParams.categoryId) ||
    Boolean(productParams.createProduct) ||
    Boolean(productParams.productId);

  const hasOpenTransactionSheets =
    Boolean(transactionParams.transactionId) ||
    Boolean(transactionParams.createTransaction) ||
    Boolean(transactionParams.editTransaction) ||
    Boolean(
      documentParams.params.filePath || documentParams.params.documentId,
    ) ||
    Boolean(inboxParams.inboxId && inboxParams.type === "details");

  const hasOpenInvoiceSheets =
    Boolean(invoiceParams.editRecurringId) ||
    invoiceParams.type === "create" ||
    invoiceParams.type === "edit" ||
    invoiceParams.type === "success" ||
    invoiceParams.type === "details";

  const hasOpenConnectSheets =
    connectParams.step === "connect" ||
    connectParams.step === "account" ||
    connectParams.step === "import";

  const hasOpenTrackerSheets =
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

  const shouldLoadSearchSheets = useStickyOverlayMount(hasOpenSearchSheets);
  const shouldLoadEntitySheets = useStickyOverlayMount(hasOpenEntitySheets);
  const shouldLoadTransactionSheets = useStickyOverlayMount(
    hasOpenTransactionSheets,
  );
  const shouldLoadInvoiceSheets = useStickyOverlayMount(hasOpenInvoiceSheets);
  const shouldLoadConnectSheets = useStickyOverlayMount(hasOpenConnectSheets);
  const shouldLoadTrackerSheets = useStickyOverlayMount(hasOpenTrackerSheets);

  useHotkeys(
    "meta+k",
    () => {
      prefetchSearchModule();
      toggleSearch();
    },
    {
      enableOnFormTags: true,
      enabled: !shouldLoadSearchSheets,
    },
  );

  return (
    <>
      {shouldLoadSearchSheets ? <GlobalSearchSheets /> : null}
      {shouldLoadEntitySheets ? <GlobalEntitySheets /> : null}
      {shouldLoadTransactionSheets ? <GlobalTransactionSheets /> : null}
      {shouldLoadInvoiceSheets ? <GlobalInvoiceSheets /> : null}
      {shouldLoadConnectSheets ? <GlobalConnectSheets /> : null}
      {shouldLoadTrackerSheets ? <GlobalTrackerSheets /> : null}
    </>
  );
}
