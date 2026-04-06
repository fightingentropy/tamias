"use client";

import { cn } from "@tamias/ui/cn";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { useMemo, useState } from "react";
import { AnimatedNumber } from "@/components/animated-number";
import { PublicComparisonBarChart } from "@/components/charts/public-report-charts";
import { SelectableChartWrapper } from "@/components/charts/selectable-chart-wrapper";
import { formatChartMonth } from "@/components/charts/chart-utils";
import { useLongPress } from "@/hooks/use-long-press";
import { useMetricsCustomize } from "@/hooks/use-metrics-customize";
import { useChatStore } from "@/store/chat";
import { useTRPC } from "@/trpc/client";
import { generateChartSelectionMessage } from "@/utils/chart-selection-message";
import { ShareMetricButton } from "../components/share-metric-button";

interface ProfitCardProps {
  from: string;
  to: string;
  currency?: string;
  locale?: string;
  isCustomizing: boolean;
  wiggleClass?: string;
  revenueType?: "net" | "gross";
}

export function ProfitCard({
  from,
  to,
  currency,
  locale,
  isCustomizing,
  wiggleClass,
  revenueType = "net",
}: ProfitCardProps) {
  const trpc = useTRPC();
  const { isCustomizing: metricsIsCustomizing, setIsCustomizing } = useMetricsCustomize();
  const setInput = useChatStore((state) => state.setInput);
  const [isSelecting, setIsSelecting] = useState(false);

  const longPressHandlers = useLongPress({
    onLongPress: () => setIsCustomizing(true),
    threshold: 500,
    disabled: metricsIsCustomizing || isSelecting,
  });

  const { data: profitData } = useQuery(
    trpc.reports.profit.queryOptions({
      from,
      to,
      currency: currency,
      revenueType,
    }),
  );

  // Transform profit data
  const profitChartData = useMemo(() => {
    if (!profitData?.result || profitData.result.length === 0) return [];

    const currentValues = profitData.result.map((item) => item.current.value);
    const average = currentValues.reduce((sum, val) => sum + val, 0) / currentValues.length;

    const totalMonths = profitData.result.length;

    return profitData.result.map((item) => ({
      month: formatChartMonth(item.current.date, totalMonths),
      label: formatChartMonth(item.current.date, totalMonths),
      profit: item.current.value,
      lastYearProfit: item.previous.value,
      average,
    }));
  }, [profitData]);

  const totalProfit = profitData?.summary?.currentTotal ?? 0;

  const dateRangeDisplay = useMemo(() => {
    try {
      const fromDate = parseISO(from);
      const toDate = parseISO(to);
      return `${format(fromDate, "MMM d")} - ${format(toDate, "MMM d, yyyy")}`;
    } catch {
      return "";
    }
  }, [from, to]);

  return (
    <div
      className={cn(
        "border bg-background border-border p-6 flex flex-col h-full relative group",
        !metricsIsCustomizing && "cursor-pointer",
      )}
      {...longPressHandlers}
    >
      <div className="mb-4 min-h-[140px]">
        <div className="flex items-start justify-between h-7">
          <h3 className="text-sm font-normal text-muted-foreground">Profit & Loss</h3>
          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 group-has-[*[data-state=open]]:opacity-100 transition-opacity">
            <ShareMetricButton type="profit" from={from} to={to} currency={currency} />
          </div>
        </div>
        <p className="text-3xl font-normal">
          <AnimatedNumber
            value={totalProfit}
            currency={currency || "USD"}
            locale={locale}
            maximumFractionDigits={0}
          />
        </p>
        <p className="text-xs mt-1 text-muted-foreground">{dateRangeDisplay}</p>
      </div>
      <div className="h-80">
        <SelectableChartWrapper
          data={profitChartData}
          dateKey="label"
          enableSelection={true}
          onSelectionStateChange={setIsSelecting}
          onSelectionComplete={(startDate, endDate) => {
            const message = generateChartSelectionMessage(startDate, endDate, "profit");
            setInput(message);
          }}
        >
          <PublicComparisonBarChart
            data={profitChartData.map((item) => ({
              label: item.label,
              primary: item.profit,
              secondary: item.lastYearProfit,
            }))}
            showAverage={true}
          />
        </SelectableChartWrapper>
      </div>
    </div>
  );
}
