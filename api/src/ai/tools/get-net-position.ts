import { db } from "@tamias/app-data/client";
import { getNetPosition } from "@tamias/app-data/queries";
import { formatAmount } from "@tamias/utils/format";
import { tool } from "ai";
import { z } from "zod";
import {
  getToolAppContext,
  getToolTeamId,
  throwIfBankAccountsRequired,
} from "../utils/tool-runtime";

const getNetPositionSchema = z.object({
  currency: z.string().describe("Currency code (ISO 4217, e.g. 'USD')").nullable().optional(),
});

export const getNetPositionTool = tool({
  description:
    "Get net financial position - shows cash (depository accounts) minus credit debt (credit cards). Useful for understanding true financial standing.",
  inputSchema: getNetPositionSchema,
  execute: async function* ({ currency }, executionOptions) {
    const appContext = getToolAppContext(executionOptions);
    const teamId = getToolTeamId(appContext);

    if (!teamId) {
      yield {
        text: "Unable to retrieve net position: Team ID not found in context.",
      };
      return {
        cash: 0,
        creditDebt: 0,
        netPosition: 0,
        currency: currency || appContext.baseCurrency || "USD",
      };
    }

    throwIfBankAccountsRequired(appContext);

    try {
      const result = await getNetPosition(db, {
        teamId,
        currency: currency ?? undefined,
      });

      const targetCurrency = currency || result.currency || appContext.baseCurrency || "USD";
      const locale = appContext.locale || "en-US";

      const formattedCash = formatAmount({
        amount: result.cash,
        currency: targetCurrency,
        locale,
      });

      const formattedCreditDebt = formatAmount({
        amount: result.creditDebt,
        currency: targetCurrency,
        locale,
      });

      const formattedNetPosition = formatAmount({
        amount: result.netPosition,
        currency: targetCurrency,
        locale,
      });

      let responseText = `**Net Position:** ${formattedNetPosition}\n\n`;
      responseText += "| Category | Amount |\n";
      responseText += "|----------|--------|\n";
      responseText += `| Cash (${result.cashAccountCount} accounts) | ${formattedCash} |\n`;
      responseText += `| Credit Debt (${result.creditAccountCount} accounts) | -${formattedCreditDebt} |\n`;
      responseText += `| **Net Position** | **${formattedNetPosition}** |\n`;

      yield { text: responseText };

      return {
        cash: result.cash,
        creditDebt: result.creditDebt,
        netPosition: result.netPosition,
        currency: targetCurrency,
        cashAccountCount: result.cashAccountCount,
        creditAccountCount: result.creditAccountCount,
      };
    } catch (error) {
      yield {
        text: `Failed to retrieve net position: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
      return {
        cash: 0,
        creditDebt: 0,
        netPosition: 0,
        currency: currency || appContext.baseCurrency || "USD",
      };
    }
  },
});
