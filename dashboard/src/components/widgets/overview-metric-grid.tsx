"use client";

import { useQuery } from "@tanstack/react-query";
import { endOfDay, startOfDay, subDays } from "date-fns";
import { FormatAmount } from "@/components/format-amount";
import { useBillableHours } from "@/hooks/use-billable-hours";
import { useMetricsFilter } from "@/hooks/use-metrics-filter";
import { useTRPC } from "@/trpc/client";
import { OverviewMetricCard } from "./overview-metric-card";
import { useOverviewWidgetQuery } from "./overview-widget-data";
import { WIDGET_POLLING_CONFIG } from "./widget-config";

export function OverviewMetricGrid() {
  const trpc = useTRPC();
  const { currency } = useMetricsFilter();

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
  const cashValue = balance ? (
    <FormatAmount
      amount={balance.totalBalance}
      currency={currency || "USD"}
      minimumFractionDigits={0}
      maximumFractionDigits={0}
    />
  ) : (
    "$0"
  );
  const cashDetail =
    balance && balance.accountCount > 0
      ? `across ${balance.accountCount} ${balance.accountCount === 1 ? "account" : "accounts"}`
      : undefined;

  const invoice = invoiceData?.result;
  const openValue = String(invoice?.count ?? 0);
  const openDetail =
    invoice && invoice.count > 0
      ? `${invoice.totalAmount > 0 ? "outstanding" : "All paid"}`
      : "All paid";

  const hours = billableData ? Math.floor((billableData.totalDuration || 0) / 3600) : 0;
  const minutes = billableData ? Math.floor(((billableData.totalDuration || 0) % 3600) / 60) : 0;
  const unbilledValue = `${hours}h ${minutes}m`;
  const earningEntries = Object.entries(billableData?.earningsByCurrency || {});
  const unbilledDetail =
    earningEntries.length > 0
      ? `${earningEntries.map(([c, a]) => `${c} ${Math.round(a as number)}`).join(", ")} this month`
      : undefined;

  const inboxStats = inboxData?.result;
  const reviewCount = (inboxStats?.newItems ?? 0) + (inboxStats?.suggestedMatches ?? 0);
  const reviewValue = String(reviewCount);
  const reviewDetail = reviewCount === 0 ? "All up to date" : "Ready to review";

  const runway = runwayData?.result;
  const runwayValue =
    runway && runway > 0 ? `${runway} ${runway === 1 ? "mo" : "mos"}` : "-";
  const runwayDetail = runway && runway > 0 ? "at current burn rate" : "No data yet";

  const pendingCount =
    (inboxStats?.pendingItems ?? 0) + (inboxStats?.analyzingItems ?? 0);
  const inboxValue = String(pendingCount);
  const inboxDetail = pendingCount === 0 ? "All caught up" : "To review";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 w-full max-w-[900px] mx-auto">
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
        label="Transactions"
        href="/transactions"
        value={reviewValue}
        detail={reviewDetail}
        isLoading={inboxLoading}
      />
      <OverviewMetricCard
        label="Runway"
        href="/invoices"
        value={runwayValue}
        detail={runwayDetail}
        isLoading={runwayLoading}
      />
      <OverviewMetricCard
        label="Inbox"
        href="/inbox"
        value={inboxValue}
        detail={inboxDetail}
        isLoading={inboxLoading}
      />
    </div>
  );
}
