"use client";

import { useArtifact } from "@ai-sdk-tools/artifacts/client";
import { cashFlowStressTestArtifact } from "@tamias/ai-artifacts/cash-flow-stress-test";
import { parseAsInteger, useQueryState } from "nuqs";
import {
  BaseCanvas,
  CanvasChart,
  CanvasGrid,
  CanvasHeader,
  CanvasSection,
} from "@/components/canvas/base";
import { CanvasContent } from "@/components/canvas/base/canvas-content";
import {
  shouldShowChart,
  shouldShowMetricsSkeleton,
  shouldShowSummarySkeleton,
} from "@/components/canvas/utils";
import { PublicMultiLineChart } from "@/components/charts/public-report-charts";
import { useUserQuery } from "@/hooks/use-user";

export function StressTestCanvas() {
  const [version] = useQueryState("version", parseAsInteger.withDefault(0));
  const [artifact] = useArtifact(cashFlowStressTestArtifact, {
    version,
  });
  const { data, status } = artifact;
  const { data: user } = useUserQuery();
  const _isLoading = status === "loading";
  const stage = data?.stage;
  const currency = data?.currency || "USD";
  const locale = user?.locale ?? undefined;

  const projectedCashBalance = data?.chart?.projectedCashBalance || [];
  const metrics = data?.metrics;

  // Prepare metrics cards
  const stressTestMetrics: Array<{
    id: string;
    title: string;
    value: string;
    subtitle: string;
  }> = [];

  // Format runway as whole months
  const formatRunway = (runway: number): string => {
    return `${Math.round(runway)} months`;
  };

  if (metrics) {
    stressTestMetrics.push(
      {
        id: "base-case-runway",
        title: "Base Case Runway",
        value: metrics.baseCaseRunway >= 999 ? "∞" : formatRunway(metrics.baseCaseRunway),
        subtitle: "Current trends continue",
      },
      {
        id: "worst-case-runway",
        title: "Worst Case Runway",
        value: metrics.worstCaseRunway >= 999 ? "∞" : formatRunway(metrics.worstCaseRunway),
        subtitle: "Revenue -30%, Expenses +20%",
      },
      {
        id: "best-case-runway",
        title: "Best Case Runway",
        value: metrics.bestCaseRunway >= 999 ? "∞" : formatRunway(metrics.bestCaseRunway),
        subtitle: "Revenue +20%, Expenses -10%",
      },
      {
        id: "stress-test-score",
        title: "Stress Test Score",
        value: `${metrics.stressTestScore}/100`,
        subtitle:
          metrics.stressTestScore >= 80
            ? "Excellent resilience"
            : metrics.stressTestScore >= 60
              ? "Good resilience"
              : metrics.stressTestScore >= 30
                ? "Concerning"
                : "Critical",
      },
    );
  }

  const showChart = shouldShowChart(stage);
  const showSummarySkeleton = shouldShowSummarySkeleton(stage);

  return (
    <BaseCanvas>
      <CanvasHeader title="Cash Flow Stress Test" />

      <CanvasContent>
        <div className="space-y-8">
          {/* Cash Balance Projection Chart */}
          {showChart && projectedCashBalance.length > 0 && (
            <CanvasChart
              title="Cash Balance Projection"
              isLoading={stage === "loading" || stage === "chart_ready"}
              height="20rem"
              legend={{
                items: [
                  {
                    label: "Base Case",
                    type: "line",
                    lineStyle: "solid",
                    color: "#000000",
                  },
                  {
                    label: "Worst Case",
                    type: "line",
                    lineStyle: "dashed",
                    color: "#666666",
                  },
                  {
                    label: "Best Case",
                    type: "line",
                    lineStyle: "dashed",
                    color: "#666666",
                  },
                ],
              }}
            >
              <PublicMultiLineChart
                data={projectedCashBalance.map((item) => ({
                  label: String(item.month),
                  baseCase: item.baseCase,
                  worstCase: item.worstCase,
                  bestCase: item.bestCase,
                }))}
                series={[
                  {
                    key: "baseCase",
                    color: "hsl(var(--foreground))",
                  },
                  {
                    key: "worstCase",
                    color: "hsl(var(--muted-foreground))",
                    dashed: true,
                  },
                  {
                    key: "bestCase",
                    color: "#9a9a9a",
                    dotted: true,
                  },
                ]}
                includeZero={true}
              />
            </CanvasChart>
          )}

          {/* Metrics Grid */}
          <CanvasGrid
            items={stressTestMetrics}
            layout="2/2"
            isLoading={shouldShowMetricsSkeleton(stage)}
          />

          {/* Summary Section */}
          <CanvasSection title="Summary" isLoading={showSummarySkeleton}>
            {data?.analysis?.summary}
          </CanvasSection>
        </div>
      </CanvasContent>
    </BaseCanvas>
  );
}
