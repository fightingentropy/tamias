"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { useBillableHours } from "./use-billable-hours";

// Check for actual records, not a zero balance or an empty review queue.
export function useWorkspaceActivity() {
  const trpc = useTRPC();
  const options = { staleTime: 60_000 };
  const transactions = useQuery({
    ...trpc.transactions.get.queryOptions({ pageSize: 1 }),
    ...options,
  });
  const invoices = useQuery({ ...trpc.invoice.get.queryOptions({ pageSize: 1 }), ...options });
  const receipts = useQuery({ ...trpc.inbox.get.queryOptions({ pageSize: 1 }), ...options });
  const accounts = useQuery({ ...trpc.bankAccounts.get.queryOptions(), ...options });
  const billableTime = useBillableHours({ date: new Date(), view: "month" });
  const isLoading =
    transactions.isPending ||
    invoices.isPending ||
    receipts.isPending ||
    accounts.isPending ||
    billableTime.isPending;
  const isError =
    transactions.isError ||
    invoices.isError ||
    receipts.isError ||
    accounts.isError ||
    billableTime.isError;
  const hasTransactions = !!transactions.data?.data.length;
  const hasInvoices = !!invoices.data?.data.length;
  const hasReceipts = !!receipts.data?.data.length;
  const hasAccounts = !!accounts.data?.length;
  const hasBillableTime = (billableTime.data?.totalDuration ?? 0) > 0;

  return {
    isLoading,
    isError,
    hasTransactions,
    hasInvoices,
    hasReceipts,
    hasAccounts,
    hasBillableTime,
    isEmpty:
      !isLoading &&
      !isError &&
      !hasTransactions &&
      !hasInvoices &&
      !hasReceipts &&
      !hasAccounts &&
      !hasBillableTime,
  };
}
