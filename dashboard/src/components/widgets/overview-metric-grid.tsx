"use client";

import { Skeleton } from "@tamias/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { endOfDay, startOfDay, subDays } from "date-fns";
import { FormatAmount } from "@/components/format-amount";
import { useBillableHours } from "@/hooks/use-billable-hours";
import { useMetricsFilter } from "@/hooks/use-metrics-filter";
import { useTeamQuery } from "@/hooks/use-team";
import { useWorkspaceActivity } from "@/hooks/use-workspace-activity";
import { useTRPC } from "@/trpc/client";
import { OverviewGetStarted } from "./overview-get-started";
import { OverviewQuickActions } from "./overview-quick-actions";
import { OverviewMetricCard } from "./overview-metric-card";
import { useOverviewWidgetQuery } from "./overview-widget-data";
import { WIDGET_POLLING_CONFIG } from "./widget-config";

export function OverviewMetricGrid() {
  const trpc = useTRPC();
  const { currency } = useMetricsFilter();
  const { data: team } = useTeamQuery();
  const activity = useWorkspaceActivity();
  const reviewQuery = useQuery({
    ...trpc.transactions.getReviewCount.queryOptions(),
    ...WIDGET_POLLING_CONFIG,
  });

  // Cash Balance — batched via OverviewWidgetDataProvider
  const { data: balanceData, isLoading: balanceLoading } = useOverviewWidgetQuery(
    "account-balances",
    {
      ...trpc.widgets.getAccountBalances.queryOptions({ currency }),
      ...WIDGET_POLLING_CONFIG,
    },
  );

  // Open Invoices — individual query
  const { data: invoiceData, isLoading: invoiceLoading } = useQuery({
    ...trpc.widgets.getOutstandingInvoices.queryOptions({
      currency,
      status: ["unpaid", "overdue"],
    }),
    ...WIDGET_POLLING_CONFIG,
  });

  // Unbilled Time
  const { data: billableData, isLoading: billableLoading } = useBillableHours({
    date: new Date(),
    view: "month",
    refetchInterval: WIDGET_POLLING_CONFIG.refetchInterval,
  });

  // Inbox Stats — shared between Transactions and Inbox cards
  const { data: inboxData, isLoading: inboxLoading } = useQuery({
    ...trpc.widgets.getInboxStats.queryOptions({
      from: startOfDay(subDays(new Date(), 7)).toISOString(),
      to: endOfDay(new Date()).toISOString(),
      currency,
    }),
    ...WIDGET_POLLING_CONFIG,
  });

  // Runway — batched via OverviewWidgetDataProvider
  const { data: runwayData, isLoading: runwayLoading } = useOverviewWidgetQuery("runway", {
    ...trpc.widgets.getRunway.queryOptions({ currency }),
    ...WIDGET_POLLING_CONFIG,
  });

  // -- Format values --

  const balance = balanceData?.result;
  const cashValue =
    balance && balance.accountCount > 0 ? (
      <FormatAmount
        amount={balance.totalBalance}
        currency={currency || team?.baseCurrency || "GBP"}
        minimumFractionDigits={0}
        maximumFractionDigits={0}
      />
    ) : (
      "—"
    );
  const cashDetail =
    balance && balance.accountCount > 0
      ? `across ${balance.accountCount} ${balance.accountCount === 1 ? "account" : "accounts"}`
      : balance
        ? "No accounts added"
        : "Unable to load balance";

  const invoice = invoiceData?.result;
  const openValue = invoice ? String(invoice.count) : "—";
  const openDetail =
    invoice && invoice.count > 0
      ? `${invoice.totalAmount > 0 ? "outstanding" : "All paid"}`
      : invoice
        ? activity.hasInvoices
          ? "No outstanding invoices"
          : "No invoices yet"
        : "Unable to load";

  const hours = billableData ? Math.floor((billableData.totalDuration || 0) / 3600) : 0;
  const minutes = billableData ? Math.floor(((billableData.totalDuration || 0) % 3600) / 60) : 0;
  const unbilledValue = billableData ? `${hours}h ${minutes}m` : "—";
  const earningEntries = Object.entries(billableData?.earningsByCurrency || {});
  const unbilledDetail =
    earningEntries.length > 0
      ? `${earningEntries.map(([c, a]) => `${c} ${Math.round(a as number)}`).join(", ")} this month`
      : undefined;

  const inboxStats = inboxData?.result;
  const reviewCount = reviewQuery.data;
  const reviewValue = reviewCount === undefined ? "—" : String(reviewCount);
  const reviewDetail =
    reviewCount === undefined
      ? "Unable to load"
      : reviewCount > 0
        ? "Ready to review"
        : activity.hasTransactions
          ? "Nothing to review"
          : "No transactions yet";

  const runway = runwayData?.result;
  const runwayValue = runway && runway > 0 ? `${runway} ${runway === 1 ? "mo" : "mos"}` : "-";
  const runwayDetail = runway && runway > 0 ? "at current burn rate" : "No data yet";

  const pendingCount = (inboxStats?.pendingItems ?? 0) + (inboxStats?.analyzingItems ?? 0);
  const inboxValue = inboxStats ? String(pendingCount) : "—";
  const inboxDetail = !inboxStats
    ? "Unable to load"
    : pendingCount > 0
      ? "Being processed"
      : activity.hasReceipts
        ? "Nothing pending"
        : "No receipts yet";

  if (activity.isLoading) {
    return (
      <div aria-label="Loading your business overview" className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((key) => (
          <Skeleton key={key} className="h-32" />
        ))}
      </div>
    );
  }
  if (activity.isEmpty) return <OverviewGetStarted />;

  return (
    <>
      <OverviewQuickActions />
      {activity.isError && (
        <p role="status" className="mb-4 text-sm text-muted-foreground">
          Some records couldn’t be loaded. Refresh to try again.
        </p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 w-full">
        <OverviewMetricCard
          label="Cash Balance"
          href="/settings/accounts"
          value={cashValue}
          detail={cashDetail}
          isLoading={balanceLoading}
        />
        <OverviewMetricCard
          label="Open Invoices"
          href="/invoices"
          value={openValue}
          detail={openDetail}
          isLoading={invoiceLoading}
        />
        <OverviewMetricCard
          label="Unbilled Time"
          href="/tracker"
          value={unbilledValue}
          detail={unbilledDetail}
          isLoading={billableLoading}
        />
        <OverviewMetricCard
          label="Transactions to review"
          href="/transactions"
          value={reviewValue}
          detail={reviewDetail}
          isLoading={reviewQuery.isPending}
        />
        <OverviewMetricCard
          label="Runway"
          href="/invoices"
          value={runwayValue}
          detail={runwayDetail}
          isLoading={runwayLoading}
        />
        <OverviewMetricCard
          label="Receipts processing"
          href="/inbox"
          value={inboxValue}
          detail={inboxDetail}
          isLoading={inboxLoading}
        />
      </div>
    </>
  );
}
