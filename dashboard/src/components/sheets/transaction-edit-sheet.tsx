"use client";

import { ScrollArea } from "@tamias/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@tamias/ui/sheet";
import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTransactionParams } from "@/hooks/use-transaction-params";
import { useTRPC } from "@/trpc/client";
import { TransactionEditForm } from "../forms/transaction-edit-form";

export function TransactionEditSheet() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { editTransaction, setParams } = useTransactionParams();
  const selectedTransactionId = editTransaction ?? null;

  const isOpen = Boolean(editTransaction);
  const transactionEditQuery = selectedTransactionId
    ? trpc.transactions.getById.queryOptions({ id: selectedTransactionId })
    : null;

  const { data: transaction } = useQuery({
    queryKey:
      transactionEditQuery?.queryKey ?? trpc.transactions.getById.queryKey(),
    queryFn: transactionEditQuery?.queryFn ?? skipToken,
    placeholderData: selectedTransactionId
      ? () => {
          const pages = queryClient
            .getQueriesData({
              queryKey: trpc.transactions.get.infiniteQueryKey(),
            })
            // @ts-expect-error
            .flatMap(([, data]) => data?.pages ?? [])
            .flatMap((page) => page.data ?? []);

          return pages.find((d) => d.id === selectedTransactionId);
        }
      : undefined,
  });

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setParams({ editTransaction: null });
    }
  };

  if (!transaction || !transaction.manual) {
    return null;
  }

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetContent>
        <SheetHeader className="mb-8">
          <SheetTitle>Edit Transaction</SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-full p-0 pb-[50px]" hideScrollbar>
          <TransactionEditForm transaction={transaction} key={transaction.id} />
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
