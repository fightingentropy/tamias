"use client";

import { Icons } from "@tamias/ui/icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useUserQuery } from "@/hooks/use-user";
import { useTRPC } from "@/trpc/client";
import { TransactionMatchItem } from "./transaction-match-item";
import { useSelectedInboxItem } from "./selected-inbox-item-context";

export function TransactionUnmatchItem() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: user } = useUserQuery();
  const selectedInboxItem = useSelectedInboxItem();

  const id = selectedInboxItem.id;

  const unmatchTransactionMutation = useMutation(
    trpc.inbox.unmatchTransaction.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.transactions.searchTransactionMatch.pathKey(),
        });
      },
      onMutate: async (variables) => {
        const { id } = variables;
        const queryKey = trpc.inbox.getById.queryKey({ id });

        await queryClient.cancelQueries({ queryKey });

        const previousInboxItem = queryClient.getQueryData(queryKey);

        if (previousInboxItem) {
          queryClient.setQueryData(queryKey, {
            ...previousInboxItem,
            transactionId: null,
            transaction: null,
          });
        }

        return { previousInboxItem };
      },
      onError: (_, variables, context) => {
        if (context?.previousInboxItem) {
          queryClient.setQueryData(
            trpc.inbox.getById.queryKey({ id: variables.id }),
            context.previousInboxItem,
          );
        }
      },
      onSettled: (_, __, variables) => {
        queryClient.invalidateQueries({
          queryKey: trpc.inbox.getById.queryKey({ id: variables.id }),
        });

        queryClient.invalidateQueries({
          queryKey: trpc.inbox.get.infiniteQueryKey(),
        });
      },
    }),
  );

  if (!selectedInboxItem.transaction) {
    return null;
  }

  return (
    <div className="bg-background h-12 flex py-3 text-sm w-full px-4 gap-4 items-center overflow-hidden border border-border dark:border-none">
      <Icons.Check className="w-4 h-4" />

      <TransactionMatchItem
        date={selectedInboxItem.transaction.date}
        name={selectedInboxItem.transaction.name}
        dateFormat={user?.dateFormat}
        amount={selectedInboxItem.transaction.amount}
        currency={selectedInboxItem.transaction.currency}
      />

      <button
        onClick={() => unmatchTransactionMutation.mutate({ id })}
        type="button"
      >
        <Icons.Delete className="w-4 h-4 text-[#878787]" />
      </button>
    </div>
  );
}
