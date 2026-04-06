"use client";

import { Sheet, SheetContent } from "@tamias/ui/sheet";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import dynamic from "@/framework/dynamic";
import { useInvoiceParams } from "@/hooks/use-invoice-params";
import { useInvoiceEditorStore } from "@/store/invoice-editor";
import { useTRPC } from "@/trpc/client";

const InvoiceEditorSheetContent = dynamic(
  () =>
    import("@/components/sheets/invoice-editor-sheet-content").then(
      (mod) => mod.InvoiceEditorSheetContent,
    ),
  { ssr: false },
);

const InvoiceSuccessSheetContent = dynamic(
  () =>
    import("@/components/sheets/invoice-success-sheet-content").then(
      (mod) => mod.InvoiceSuccessSheetContent,
    ),
  { ssr: false },
);

export function InvoiceSheet() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { setParams, type, invoiceId } = useInvoiceParams();
  const isOpen = type === "create" || type === "edit" || type === "success";
  const shouldLoadForm = type === "create" || type === "edit";

  const { data: defaultSettings } = useQuery({
    ...trpc.invoice.defaultSettings.queryOptions(),
    enabled: shouldLoadForm,
  });

  // Get draft invoice for edit
  const { data } = useQuery(
    trpc.invoice.getById.queryOptions(
      {
        id: invoiceId!,
      },
      {
        enabled: type === "edit" && !!invoiceId,
        staleTime: 30 * 1000, // 30 seconds - prevents excessive refetches when reopening
      },
    ),
  );

  const handleOnOpenChange = (open: boolean) => {
    if (!open) {
      // Invalidate queries when closing the sheet to prevent stale data
      queryClient.invalidateQueries({
        queryKey: trpc.invoice.getById.queryKey(),
      });

      queryClient.invalidateQueries({
        queryKey: trpc.invoice.defaultSettings.queryKey(),
      });

      // Clear the draft snapshot so the next open starts fresh
      useInvoiceEditorStore.getState().reset();
    }

    setParams(null);
  };

  if (type === "success") {
    return (
      <Sheet open={isOpen} onOpenChange={handleOnOpenChange}>
        <InvoiceSuccessSheetContent />
      </Sheet>
    );
  }

  if (shouldLoadForm && !defaultSettings) {
    return (
      <Sheet open={isOpen} onOpenChange={handleOnOpenChange}>
        <SheetContent className="bg-white dark:bg-[#080808] p-6">
          <span className="text-sm text-muted-foreground">
            Loading invoice settings...
          </span>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={isOpen} onOpenChange={handleOnOpenChange}>
      <InvoiceEditorSheetContent defaultSettings={defaultSettings} data={data} />
    </Sheet>
  );
}
