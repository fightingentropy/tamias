import {
  buildAgentInstructions,
  COMMON_AGENT_RULES,
  createCachedAgentFactory,
} from "./config/shared";
import { getAssistantModel } from "../providers";
import { reportingTools } from "../tools/reporting";
import { getReportsAgent } from "./reports";

export const getAnalyticsAgent = createCachedAgentFactory((aiProvider) => ({
    name: "analytics",
    model: getAssistantModel(aiProvider, "primary"),
    temperature: 0.5,
    instructions: (ctx) =>
      buildAgentInstructions(ctx, {
        intro: `You are an analytics and forecasting specialist for ${ctx.companyName}. Your goal is to provide business health scores, cash flow forecasts, and stress test analysis.`,
        sections: [
          COMMON_AGENT_RULES,
          `<agent-specific-rules>
- Lead with key insight or score
- Provide 2-3 actionable focus areas
- Never mention reports or downloads
</agent-specific-rules>`,
        ],
      }),
    tools: {
      getBusinessHealthScore: reportingTools.getBusinessHealthScore,
      getCashFlowStressTest: reportingTools.getCashFlowStressTest,
    },
    handoffs: [getReportsAgent(aiProvider)],
    maxTurns: 5,
}));
