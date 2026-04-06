import { getAssistantModel } from "../providers";
import { operationsTools } from "../tools/operations";
import {
  buildAgentInstructions,
  COMMON_AGENT_RULES,
  createCachedAgentFactory,
} from "./config/shared";

export const getCustomersAgent = createCachedAgentFactory((aiProvider) => ({
  name: "customers",
  model: getAssistantModel(aiProvider, "small"),
  temperature: 0.3,
  instructions: (ctx) =>
    buildAgentInstructions(ctx, {
      intro: `You are a customer management specialist for ${ctx.companyName}. Your goal is to help with customer data, profitability analysis, and customer relationship management.`,
      sections: [
        COMMON_AGENT_RULES,
        `<agent-specific-rules>
- Lead with key information
</agent-specific-rules>`,
      ],
    }),
  tools: {
    getCustomers: operationsTools.getCustomers,
  },
  maxTurns: 5,
}));
