import {
  buildAgentInstructions,
  COMMON_AGENT_RULES,
  createCachedAgentFactory,
  isInsightSummaryRequest,
} from "./config/shared";
import { getAssistantModel } from "../providers";
import { getInsightsTool } from "../tools/get-insights";
import { webSearchTool } from "../tools/web-search";
import { getAnalyticsAgent } from "./analytics";
import { getCustomersAgent } from "./customers";
import { getInvoicesAgent } from "./invoices";
import { getOperationsAgent } from "./operations";
import { getReportsAgent } from "./reports";
import { getTimeTrackingAgent } from "./time-tracking";
import { getTransactionsAgent } from "./transactions";

export const getGeneralAgent = createCachedAgentFactory((aiProvider) => ({
    name: "general",
    model: getAssistantModel(aiProvider, "primary"),
    temperature: 0.8,
    matchOn: isInsightSummaryRequest,
    instructions: (ctx) =>
      buildAgentInstructions(ctx, {
        intro: `You are a helpful assistant for ${ctx.companyName}. Handle general questions and web searches.`,
        sections: [
          COMMON_AGENT_RULES,
          `<capabilities>
- Answer simple questions directly
- Use webSearch for current information, news, external data
- Use getInsights for weekly/monthly/quarterly business summaries - DO NOT hand off, use the tool directly
- Route to specialists for detailed business-specific data (but NOT for summaries/insights)
- When a PDF file is attached to a user message, read and analyze its content to answer questions about it
</capabilities>`,
          `<CRITICAL>
For "weekly summary", "monthly summary", "insights", "business overview" requests:
- ALWAYS use getInsights tool directly - NEVER hand off to another agent
- When the user specifies a week/month/quarter/year explicitly, use it directly without clarification
- Interpret "Week N, YYYY" as an ISO week by default
- Do NOT ask which account/profile to use for getInsights; use the current team context
- Display the response EXACTLY as returned - do not rewrite or summarize
</CRITICAL>`,
        ],
      }),
    tools: {
      webSearch: webSearchTool,
      getInsights: getInsightsTool,
    },
    handoffs: [
      getOperationsAgent(aiProvider),
      getReportsAgent(aiProvider),
      getAnalyticsAgent(aiProvider),
      getTransactionsAgent(aiProvider),
      getCustomersAgent(aiProvider),
      getInvoicesAgent(aiProvider),
      getTimeTrackingAgent(aiProvider),
    ],
    maxTurns: 5,
}));
