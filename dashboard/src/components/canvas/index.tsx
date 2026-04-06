import { useArtifacts } from "@ai-sdk-tools/artifacts/client";
import { parseAsString, useQueryState } from "nuqs";
import dynamic from "@/framework/dynamic";
import { ErrorBoundary } from "@/components/error-boundary";
import { isMonthlyBreakdownType } from "@/lib/metrics-breakdown-constants";
import { CanvasErrorFallback } from "./base/canvas-error-fallback";

const BurnRateCanvas = dynamic(
  () => import("./burn-rate-canvas").then((mod) => mod.BurnRateCanvas),
  { ssr: false },
);
const RevenueCanvas = dynamic(() => import("./revenue-canvas").then((mod) => mod.RevenueCanvas), {
  ssr: false,
});
const ProfitCanvas = dynamic(() => import("./profit-canvas").then((mod) => mod.ProfitCanvas), {
  ssr: false,
});
const GrowthRateCanvas = dynamic(
  () => import("./growth-rate-canvas").then((mod) => mod.GrowthRateCanvas),
  { ssr: false },
);
const RunwayCanvas = dynamic(() => import("./runway-canvas").then((mod) => mod.RunwayCanvas), {
  ssr: false,
});
const CashFlowCanvas = dynamic(
  () => import("./cash-flow-canvas").then((mod) => mod.CashFlowCanvas),
  { ssr: false },
);
const BalanceSheetCanvas = dynamic(
  () => import("./balance-sheet-canvas").then((mod) => mod.BalanceSheetCanvas),
  { ssr: false },
);
const CategoryExpensesCanvas = dynamic(
  () => import("./category-expenses-canvas").then((mod) => mod.CategoryExpensesCanvas),
  { ssr: false },
);
const HealthReportCanvas = dynamic(
  () => import("./health-report-canvas").then((mod) => mod.HealthReportCanvas),
  { ssr: false },
);
const SpendingCanvas = dynamic(
  () => import("./spending-canvas").then((mod) => mod.SpendingCanvas),
  { ssr: false },
);
const ForecastCanvas = dynamic(
  () => import("./forecast-canvas").then((mod) => mod.ForecastCanvas),
  { ssr: false },
);
const TaxSummaryCanvas = dynamic(
  () => import("./tax-summary-canvas").then((mod) => mod.TaxSummaryCanvas),
  { ssr: false },
);
const StressTestCanvas = dynamic(
  () => import("./stress-test-canvas").then((mod) => mod.StressTestCanvas),
  { ssr: false },
);
const InvoicePaymentCanvas = dynamic(
  () => import("./invoice-payment-canvas").then((mod) => mod.InvoicePaymentCanvas),
  { ssr: false },
);
const MetricsBreakdownSummaryCanvas = dynamic(
  () =>
    import("./metrics-breakdown-summary-canvas").then((mod) => mod.MetricsBreakdownSummaryCanvas),
  { ssr: false },
);

const canvasComponents = {
  "balance-sheet-canvas": BalanceSheetCanvas,
  "burn-rate-canvas": BurnRateCanvas,
  "cash-flow-canvas": CashFlowCanvas,
  "category-expenses-canvas": CategoryExpensesCanvas,
  "forecast-canvas": ForecastCanvas,
  "growth-rate-canvas": GrowthRateCanvas,
  "health-report-canvas": HealthReportCanvas,
  "invoice-payment-canvas": InvoicePaymentCanvas,
  "profit-analysis-canvas": ProfitCanvas,
  "profit-canvas": ProfitCanvas,
  "revenue-canvas": RevenueCanvas,
  "runway-canvas": RunwayCanvas,
  "spending-canvas": SpendingCanvas,
  "stress-test-canvas": StressTestCanvas,
  "tax-summary-canvas": TaxSummaryCanvas,
} as const;

export function Canvas() {
  const [selectedType, setSelectedType] = useQueryState("artifact-type", parseAsString);

  const [data] = useArtifacts({
    value: selectedType,
    onChange: (v) => setSelectedType(v ?? null),
    exclude: ["chat-title", "suggestions"],
  });

  const activeType = data.activeType;
  const CanvasComponent =
    activeType === "breakdown-summary-canvas" || (activeType && isMonthlyBreakdownType(activeType))
      ? MetricsBreakdownSummaryCanvas
      : activeType
        ? canvasComponents[activeType as keyof typeof canvasComponents]
        : null;

  return (
    <ErrorBoundary key={selectedType} fallback={<CanvasErrorFallback />}>
      {CanvasComponent ? <CanvasComponent /> : null}
    </ErrorBoundary>
  );
}
