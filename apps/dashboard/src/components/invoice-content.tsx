"use client";

import { SheetContent } from "@tamias/ui/sheet";
import { useFormContext } from "react-hook-form";
import { Form } from "@/components/invoice/form";
import { InvoiceSuccess } from "@/components/invoice-success";
import { useInvoiceParams } from "@/hooks/use-invoice-params";

export function InvoiceContent() {
  const { type } = useInvoiceParams();

  if (type === "success") {
    return (
      <SheetContent className="bg-white dark:bg-[#080808] transition-[max-width] duration-300 ease-in-out">
        <InvoiceSuccess />
      </SheetContent>
    );
  }

  return <InvoiceFormContent />;
}

function InvoiceFormContent() {
  const { watch } = useFormContext();
  const templateSize = watch("template.size");
  const size = templateSize === "a4" ? 650 : 740;

  return (
    <SheetContent
      style={{ maxWidth: size }}
      className="bg-white dark:bg-[#080808] transition-[max-width] duration-300 ease-in-out p-0"
    >
      <Form />
    </SheetContent>
  );
}
