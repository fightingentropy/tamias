import { tool } from "ai";
import { z } from "zod";
import {
  type OpenAIWebSearchSource,
  runOpenAIWebSearch,
} from "../utils/openai-web-search";
import { getToolAppContext } from "../utils/tool-runtime";

export const webSearchTool = tool({
  description:
    "Search the web for current information, prices, news, and external data.",
  inputSchema: z.object({
    query: z.string().describe("Search query"),
  }),
  execute: async ({ query }, executionOptions) => {
    const appContext = getToolAppContext(executionOptions);

    try {
      const { context, sources } = await runOpenAIWebSearch({
        query,
        currentDateTime: appContext.currentDateTime,
        country: appContext.country,
        timezone: appContext.timezone,
      });

      return {
        query,
        found: sources.length,
        context,
        sources: sources satisfies OpenAIWebSearchSource[],
      };
    } catch (error) {
      return {
        query,
        found: 0,
        context: null,
        sources: [],
        error: error instanceof Error ? error.message : "Search failed",
      };
    }
  },
});
