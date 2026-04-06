import { getAssistantModel } from "../providers";
import { timeTrackingTools } from "../tools/time-tracking";
import {
  buildAgentInstructions,
  COMMON_AGENT_RULES,
  createCachedAgentFactory,
} from "./config/shared";

export const getTimeTrackingAgent = createCachedAgentFactory((aiProvider) => ({
  name: "timeTracking",
  model: getAssistantModel(aiProvider, "small"),
  temperature: 0.3,
  instructions: (ctx) =>
    buildAgentInstructions(ctx, {
      intro: `You are a time tracking specialist for ${ctx.companyName}. Your goal is to help manage time entries, track project hours, and control timers.`,
      sections: [
        COMMON_AGENT_RULES,
        `<agent-specific-rules>
- Lead with key information
- Present time data clearly: duration, project, date
- Summarize totals when showing multiple entries
</agent-specific-rules>`,
      ],
    }),
  tools: timeTrackingTools,
  maxTurns: 2,
}));
