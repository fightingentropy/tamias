import { getOverviewWidgetsSchema } from "../../schemas/widgets";
import { protectedProcedure } from "../init";
import {
  getCashBalance,
  getReports,
  getRevenueForecast,
  getRunway,
} from "@tamias/app-data/queries";
import type { WidgetType } from "@tamias/domain";
import {
  getCashFlowWidgetData,
  getGrowthRateWidgetData,
  getRevenueSummaryWidgetData,
} from "./widgets-shared";

export const widgetOverviewProcedures = {
  getOverview: protectedProcedure
    .input(getOverviewWidgetsSchema)
    .query(async ({ ctx: { db, teamId }, input }) => {
      const requestedWidgets = new Set<WidgetType>(input.widgets);
      const overviewTasks: Array<Promise<readonly [WidgetType, unknown]>> = [];

      if (requestedWidgets.has("runway")) {
        overviewTasks.push(
          (async () =>
            [
              "runway",
              {
                result: await getRunway(db, {
                  teamId: teamId!,
                  currency: input.currency,
                }),
                toolCall: {
                  toolName: "getBurnRateAnalysis",
                  toolParams: {
                    currency: input.currency,
                  },
                },
              },
            ] as const)(),
        );
      }

      if (requestedWidgets.has("cash-flow")) {
        overviewTasks.push(
          (async () =>
            [
              "cash-flow",
              await getCashFlowWidgetData(db, teamId!, input),
            ] as const)(),
        );
      }

      if (requestedWidgets.has("account-balances")) {
        overviewTasks.push(
          (async () =>
            [
              "account-balances",
              {
                result: await getCashBalance(db, {
                  teamId: teamId!,
                  currency: input.currency,
                }),
              },
            ] as const)(),
        );
      }

      if (requestedWidgets.has("profit-analysis")) {
        overviewTasks.push(
          (async () =>
            [
              "profit-analysis",
              await getReports(db, {
                teamId: teamId!,
                from: input.from,
                to: input.to,
                currency: input.currency,
                type: "profit",
                revenueType: input.revenueType,
              }),
            ] as const)(),
        );
      }

      if (requestedWidgets.has("revenue-forecast")) {
        overviewTasks.push(
          (async () =>
            [
              "revenue-forecast",
              await getRevenueForecast(db, {
                teamId: teamId!,
                from: input.from,
                to: input.to,
                forecastMonths: 6,
                currency: input.currency,
                revenueType: input.revenueType,
              }),
            ] as const)(),
        );
      }

      if (requestedWidgets.has("revenue-summary")) {
        overviewTasks.push(
          (async () =>
            [
              "revenue-summary",
              await getRevenueSummaryWidgetData(db, teamId!, input),
            ] as const)(),
        );
      }

      if (requestedWidgets.has("growth-rate")) {
        overviewTasks.push(
          (async () =>
            [
              "growth-rate",
              await getGrowthRateWidgetData(db, teamId!, input),
            ] as const)(),
        );
      }

      const overviewEntries = await Promise.all(overviewTasks);

      return Object.fromEntries(overviewEntries);
    }),
};
