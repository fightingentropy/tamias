import { Agent, type AgentConfig } from "@ai-sdk-tools/agents";
import { chatMemoryProvider } from "@tamias/app-services/chat-memory";
import type { ChatUserContext } from "@tamias/cache/chat-cache";
import { type AIProvider, DEFAULT_AI_PROVIDER } from "@tamias/domain/identity";
import { getAssistantModel } from "../../providers";
import { memoryTemplate, suggestionsInstructions, titleInstructions } from "./generated-prompts";

export function formatContextForLLM(context: AppContext): string {
  return `<company_info>
<current_date>${context.currentDateTime}</current_date>
<timezone>${context.timezone}</timezone>
<company_name>${context.companyName}</company_name>
<base_currency>${context.baseCurrency}</base_currency>
<locale>${context.locale}</locale>
</company_info>

Important: Use the current date/time above for time-sensitive operations. User-specific information is maintained in your working memory.`;
}

export const COMMON_AGENT_RULES = `<behavior_rules>
- Call tools immediately without explanatory text
- Use parallel tool calls when possible
- Provide specific numbers and actionable insights
- Explain your reasoning
- Lead with the most important information first
- When presenting repeated structured data (lists of items, multiple entries, time series), always use markdown tables
- Tables make data scannable and easier to compare - use them for any data with 2+ rows
</behavior_rules>`;

export const INSIGHT_SUMMARY_MATCHERS = [
  /\bweekly summary\b/i,
  /\bmonthly summary\b/i,
  /\bquarterly summary\b/i,
  /\byearly summary\b/i,
  /\bsummary for (?:week|month|quarter|year)\b/i,
  /\b(?:weekly|monthly|quarterly|yearly) insights?\b/i,
  /\bbusiness overview\b/i,
  /\binsights?\b/i,
];

export function isInsightSummaryRequest(message: string) {
  return INSIGHT_SUMMARY_MATCHERS.some((matcher) => matcher.test(message));
}

type PromptSection = string | ((context: AppContext) => string);

function resolvePromptSection(section: PromptSection, context: AppContext) {
  return typeof section === "function" ? section(context) : section;
}

function joinPromptSections(sections: Array<string | null>) {
  return sections.filter((section): section is string => Boolean(section)).join("\n\n");
}

export function wrapPromptTag(tag: string, content: string) {
  return `<${tag}>\n${content}\n</${tag}>`;
}

export function buildAgentInstructions(
  context: AppContext,
  options: {
    intro: PromptSection;
    contextTag?: string;
    contextContent?: PromptSection;
    sections?: PromptSection[];
  },
) {
  const intro = resolvePromptSection(options.intro, context);
  const contextTag = options.contextTag ?? "background-data";
  const contextContent = resolvePromptSection(
    options.contextContent ?? formatContextForLLM,
    context,
  );
  const sections = (options.sections ?? []).map((section) =>
    resolvePromptSection(section, context),
  );

  return joinPromptSections([intro, wrapPromptTag(contextTag, contextContent), ...sections]);
}

/**
 * Dashboard metrics filter state - source of truth for AI tool defaults.
 * When present, tools use these values unless explicitly overridden.
 */
export interface MetricsFilter {
  period: string; // "1-year", "6-months", etc.
  from: string; // yyyy-MM-dd
  to: string; // yyyy-MM-dd
  currency?: string;
  revenueType: "gross" | "net";
}

/**
 * Forced tool call from widget click - bypasses AI parameter decisions.
 * When present for a matching tool, these params are used directly.
 */
export interface ForcedToolCall {
  toolName: string;
  toolParams: Record<string, unknown>;
}

export interface AppContext {
  userId: string;
  convexUserId: string;
  fullName: string;
  companyName: string;
  baseCurrency: string;
  locale: string;
  currentDateTime: string;
  country?: string;
  city?: string;
  region?: string;
  timezone: string;
  chatId: string;
  aiProvider: AIProvider;
  fiscalYearStartMonth?: number | null;
  hasBankAccounts?: boolean;

  /**
   * Dashboard metrics filter state (source of truth for defaults).
   * Tools use these values when no explicit params are provided.
   */
  metricsFilter?: MetricsFilter;

  /**
   * Forced tool params from widget click (bypasses AI decisions).
   * When a widget sends toolParams, they're stored here and used directly.
   */
  forcedToolCall?: ForcedToolCall;

  // Allow additional properties to satisfy Record<string, unknown> constraint
  [key: string]: unknown;
}

export function buildAppContext(
  context: ChatUserContext,
  chatId: string,
  options?: {
    aiProvider?: AIProvider;
    metricsFilter?: MetricsFilter;
    forcedToolCall?: ForcedToolCall;
  },
): AppContext {
  // Combine userId and teamId to scope chats by both user and team
  const scopedUserId = `${context.userId}:${context.teamId}`;

  return {
    userId: scopedUserId,
    convexUserId: context.userId,
    fullName: context.fullName ?? "",
    companyName: context.teamName ?? "",
    country: context.country ?? undefined,
    city: context.city ?? undefined,
    region: context.region ?? undefined,
    chatId,
    baseCurrency: context.baseCurrency ?? "USD",
    locale: context.locale ?? "en-US",
    currentDateTime: new Date().toISOString(),
    timezone: context.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    aiProvider: options?.aiProvider ?? DEFAULT_AI_PROVIDER,
    teamId: context.teamId,
    fiscalYearStartMonth: context.fiscalYearStartMonth ?? undefined,
    hasBankAccounts: context.hasBankAccounts ?? false,
    // Dashboard filter state and forced tool params
    metricsFilter: options?.metricsFilter,
    forcedToolCall: options?.forcedToolCall,
  };
}

export const memoryProvider = chatMemoryProvider;

function wrapAsyncIterable<T>(sourcePromise: Promise<AsyncIterable<T>>) {
  return {
    async *[Symbol.asyncIterator]() {
      const source = await sourcePromise;

      for await (const chunk of source) {
        yield chunk;
      }
    },
  };
}

function patchAgentStreamCompatibility(agent: Agent<AppContext>) {
  const originalStream = agent.stream.bind(agent);

  agent.stream = ((options: Parameters<typeof originalStream>[0]) => {
    const resultPromise = Promise.resolve(originalStream(options as any));

    return {
      // Compatibility shim intentionally exposes then/catch/finally on agent streams.
      then: resultPromise.then.bind(resultPromise),
      catch: resultPromise.catch.bind(resultPromise),
      finally: resultPromise.finally.bind(resultPromise),
      toUIMessageStream: (...args: any[]) =>
        wrapAsyncIterable(resultPromise.then((result: any) => result.toUIMessageStream(...args))),
      toUIMessageStreamResponse: (...args: any[]) =>
        resultPromise.then((result: any) => result.toUIMessageStreamResponse(...args)),
      toDataStreamResponse: (...args: any[]) =>
        resultPromise.then((result: any) => result.toDataStreamResponse(...args)),
    } as unknown as ReturnType<typeof originalStream>;
  }) as typeof agent.stream;

  return agent;
}

export const createAgent = (
  config: AgentConfig<AppContext>,
  aiProvider: AIProvider = DEFAULT_AI_PROVIDER,
) => {
  return patchAgentStreamCompatibility(
    new Agent({
      ...config,
      memory: {
        provider: memoryProvider,
        history: {
          enabled: true,
          limit: 10,
        },
        workingMemory: {
          enabled: true,
          template: memoryTemplate,
          scope: "user",
        },
        chats: {
          enabled: true,
          generateTitle: {
            model: getAssistantModel(aiProvider, "micro"),
            instructions: titleInstructions,
          },
          generateSuggestions: {
            enabled: true,
            model: getAssistantModel(aiProvider, "micro"),
            limit: 5,
            instructions: suggestionsInstructions,
          },
        },
      },
    }),
  );
};

type AppAgent = ReturnType<typeof createAgent>;

export function createCachedAgentFactory(
  buildConfig: (aiProvider: AIProvider) => AgentConfig<AppContext>,
) {
  const cache = new Map<AIProvider, AppAgent>();

  return (aiProvider: AIProvider): AppAgent => {
    const existing = cache.get(aiProvider);

    if (existing) {
      return existing;
    }

    const agent = createAgent(buildConfig(aiProvider), aiProvider);
    cache.set(aiProvider, agent);
    return agent;
  };
}
