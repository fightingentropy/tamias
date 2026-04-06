import { openai } from "@ai-sdk/openai";
import { generateText, stepCountIs, type ToolSet } from "ai";

export interface OpenAIWebSearchSource {
  url: string;
  title: string;
  publishedDate?: string;
}

interface OpenAIWebSearchParams {
  query: string;
  currentDateTime: string;
  country?: string;
  timezone: string;
}

function createOpenAIWebSearchTools({
  country,
  timezone,
}: Pick<OpenAIWebSearchParams, "country" | "timezone">): ToolSet {
  // OpenAI's built-in web search tool is provider-defined at runtime, but the
  // core ToolSet type currently only models executable local tools.
  return {
    web_search: openai.tools.webSearch({
      searchContextSize: "low",
      userLocation: {
        type: "approximate",
        country,
        timezone,
      },
    }),
  } as unknown as ToolSet;
}

function extractSources(result: Awaited<ReturnType<typeof generateText>>): OpenAIWebSearchSource[] {
  const rawSources: Array<{ url: string; title?: string }> = [];

  if (result.steps?.[0]?.content && Array.isArray(result.steps[0].content)) {
    for (const item of result.steps[0].content) {
      if (item.type === "source" && item.sourceType === "url") {
        rawSources.push({
          url: item.url,
          title: item.title || item.url,
        });
      }
    }
  }

  return rawSources.slice(0, 3).map((source) => ({
    url: source.url,
    title: source.title || source.url,
  }));
}

export async function runOpenAIWebSearch({
  query,
  currentDateTime,
  country,
  timezone,
}: OpenAIWebSearchParams): Promise<{
  context: string;
  sources: OpenAIWebSearchSource[];
}> {
  const result = await generateText({
    model: openai.responses("gpt-5-mini"),
    prompt: `<search-request>
              Search for: ${query}
              Current date: ${currentDateTime}
              Focus on recent information.
            </search-request>`,
    stopWhen: stepCountIs(1),
    tools: createOpenAIWebSearchTools({ country, timezone }),
    temperature: 0,
  });

  return {
    context: result.text || "",
    sources: extractSources(result),
  };
}
