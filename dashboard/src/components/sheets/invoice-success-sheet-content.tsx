"use client";

import { SheetContent } from "@tamias/ui/sheet";
import dynamic from "@/framework/dynamic";

const InvoiceSuccess = dynamic(
  () => import("@/components/invoice-success").then((mod) => mod.InvoiceSuccess),
  { ssr: false },
);

export function InvoiceSuccessSheetContent() {
  return (
    <SheetContent className="bg-white dark:bg-[#080808] transition-[max-width] duration-300 ease-in-out">
      <InvoiceSuccess />
    </SheetContent>
  );
}
