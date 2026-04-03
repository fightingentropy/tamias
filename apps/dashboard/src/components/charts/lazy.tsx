"use client";

import dynamic from "@/framework/dynamic";

export const BurnRateChart = dynamic(
  () => import("./burn-rate-chart").then((mod) => mod.BurnRateChart),
  { ssr: false },
);

export const BusinessHealthScoreChart = dynamic(
  () =>
    import("./business-health-score-chart").then(
      (mod) => mod.BusinessHealthScoreChart,
    ),
  { ssr: false },
);

export const CashFlowChart = dynamic(
  () => import("./cash-flow-chart").then((mod) => mod.CashFlowChart),
  { ssr: false },
);

export const CategoryExpenseDonutChart = dynamic(
  () =>
    import("./category-expense-donut-chart").then(
      (mod) => mod.CategoryExpenseDonutChart,
    ),
  { ssr: false },
);

export const GrowthRateChart = dynamic(
  () => import("./growth-rate-chart").then((mod) => mod.GrowthRateChart),
  { ssr: false },
);

export const InvoicePaymentChart = dynamic(
  () =>
    import("./invoice-payment-chart").then((mod) => mod.InvoicePaymentChart),
  { ssr: false },
);

export const MonthlyRevenueChart = dynamic(
  () =>
    import("./monthly-revenue-chart").then((mod) => mod.MonthlyRevenueChart),
  { ssr: false },
);

export const ProfitChart = dynamic(
  () => import("./profit-chart").then((mod) => mod.ProfitChart),
  { ssr: false },
);

export const RevenueForecastChart = dynamic(
  () =>
    import("./revenue-forecast-chart").then(
      (mod) => mod.RevenueForecastChart,
    ),
  { ssr: false },
);

export const RevenueTrendChart = dynamic(
  () => import("./revenue-trend-chart").then((mod) => mod.RevenueTrendChart),
  { ssr: false },
);

export const RunwayChart = dynamic(
  () => import("./runway-chart").then((mod) => mod.RunwayChart),
  { ssr: false },
);

export const StackedBarChart = dynamic(
  () => import("./stacked-bar-chart").then((mod) => mod.StackedBarChart),
  { ssr: false },
);

export const StressTestChart = dynamic(
  () => import("./stress-test-chart").then((mod) => mod.StressTestChart),
  { ssr: false },
);

export const grayShades = [
  "hsl(var(--foreground))",
  "#707070",
  "#A0A0A0",
  "#606060",
  "#404040",
  "#303030",
  "#202020",
];
