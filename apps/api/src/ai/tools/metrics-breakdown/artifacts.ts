import { artifact, getWriter } from "@ai-sdk-tools/artifacts";
import { metricsBreakdownSummaryArtifact } from "@tamias/ai-artifacts/metrics-breakdown";
import { z } from "zod";
import { generateArtifactDescription } from "../../utils/artifact-title";
import {
  startArtifactStream,
  type ToolExecutionOptions,
} from "../../utils/tool-runtime";
import { createMonthlyArtifactType } from "../metrics-breakdown-constants";
import type { MonthlyPeriod } from "./types";

const baseBreakdownSchema = z.object({
  stage: z.enum(["loading", "chart_ready", "metrics_ready", "analysis_ready"]),
  currency: z.string(),
  from: z.string().optional().describe("Start date (ISO 8601)"),
  to: z.string().optional().describe("End date (ISO 8601)"),
  displayDate: z
    .string()
    .optional()
    .describe(
      "Date for display purposes (ISO 8601, typically start of month for monthly breakdowns)",
    ),
  description: z
    .string()
    .optional()
    .describe("Generated description based on date range"),
  chartType: z
    .string()
    .optional()
    .describe("Type of chart that triggered this breakdown"),
});

const summaryMetricsSchema = z.object({
  revenue: z.number(),
  expenses: z.number(),
  profit: z.number(),
  transactionCount: z.number(),
});

const transactionSchema = z.object({
  id: z.string(),
  date: z.string(),
  name: z.string(),
  amount: z.number(),
  formattedAmount: z.string(),
  category: z.string(),
  type: z.enum(["income", "expense"]),
  vendor: z.string(),
  percentage: z.number(),
});

const categorySchema = z.object({
  name: z.string(),
  amount: z.number(),
  percentage: z.number(),
  transactionCount: z.number().optional(),
  color: z.string().optional(),
});

function createMonthlyBreakdownArtifact(monthKey: string) {
  return artifact(
    createMonthlyArtifactType(monthKey),
    baseBreakdownSchema.extend({
      summary: summaryMetricsSchema.optional(),
      transactions: z.array(transactionSchema).optional(),
      categories: z.array(categorySchema).optional(),
      analysis: z
        .object({
          summary: z.string(),
          recommendations: z.array(z.string()),
        })
        .optional(),
    }),
  );
}

export type MonthlyBreakdownArtifactStream = ReturnType<
  ReturnType<typeof createMonthlyBreakdownArtifact>["stream"]
>;

export type MonthlyBreakdownArtifactEntry = {
  artifact: MonthlyBreakdownArtifactStream;
  period: MonthlyPeriod;
  description: string;
};

export function startMonthlyBreakdownArtifacts(options: {
  executionOptions: ToolExecutionOptions;
  periods: MonthlyPeriod[];
  currency: string;
  chartType?: string;
}): MonthlyBreakdownArtifactEntry[] {
  const writer = getWriter(options.executionOptions);

  return options.periods.map((period) => {
    const description = generateArtifactDescription(period.from, period.to);
    const artifactStream = createMonthlyBreakdownArtifact(
      period.monthKey,
    ).stream(
      {
        stage: "loading" as const,
        currency: options.currency,
        from: period.from,
        to: period.to,
        displayDate: period.from,
        description,
        chartType: options.chartType || undefined,
      },
      writer,
    );

    return {
      artifact: artifactStream,
      period,
      description,
    };
  });
}

export function startMetricsBreakdownSummaryArtifact(options: {
  enabled: boolean;
  executionOptions: ToolExecutionOptions;
  currency: string;
  from: string;
  to: string;
  chartType?: string;
}) {
  return startArtifactStream({
    enabled: options.enabled,
    executionOptions: options.executionOptions,
    artifact: metricsBreakdownSummaryArtifact,
    input: {
      stage: "loading" as const,
      currency: options.currency,
      from: options.from,
      to: options.to,
      displayDate: options.from,
      description: generateArtifactDescription(options.from, options.to),
      chartType: options.chartType || undefined,
    },
  });
}
