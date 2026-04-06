"use client";

import dynamic from "@/framework/dynamic";
import { useInvoiceParams } from "@/hooks/use-invoice-params";
import { useDeferredSheetMount } from "./global-sheet-mount";

const EditRecurringSheet = dynamic(
  () => import("@/components/sheets/edit-recurring-sheet").then((mod) => mod.EditRecurringSheet),
  { ssr: false },
);

const InvoiceDetailsSheet = dynamic(
  () => import("@/components/sheets/invoice-details-sheet").then((mod) => mod.InvoiceDetailsSheet),
  { ssr: false },
);

const InvoiceSheet = dynamic(
  () => import("@/components/sheets/invoice-sheet").then((mod) => mod.InvoiceSheet),
  { ssr: false },
);

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

export function GlobalInvoiceSheets() {
  return (
    <>
      <InvoiceDetailsSheetMount />
      <InvoiceSheetMount />
      <EditRecurringSheetMount />
    </>
  );
}
