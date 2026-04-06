"use client";

import type { RouterOutputs } from "@tamias/trpc";
import { SheetContent } from "@tamias/ui/sheet";
import { useFormContext } from "react-hook-form";
import dynamic from "@/framework/dynamic";
import { FormContext } from "@/components/invoice/form-context";

const Form = dynamic(() => import("@/components/invoice/form").then((mod) => mod.Form), {
  ssr: false,
});

type Props = {
  data?: RouterOutputs["invoice"]["getById"];
  defaultSettings?: RouterOutputs["invoice"]["defaultSettings"];
};

export function InvoiceEditorSheetContent({ data, defaultSettings }: Props) {
  return (
    <FormContext defaultSettings={defaultSettings} data={data}>
      <InvoiceFormSheetContent />
    </FormContext>
  );
}

function InvoiceFormSheetContent() {
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
