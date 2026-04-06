import { getWriter } from "@ai-sdk-tools/artifacts";
import type { AppContext } from "../agents/config/shared";
import { generateArtifactDescription } from "./artifact-title";
import {
  type ResolveToolParamsOptions,
  resolveToolParams,
} from "./period-dates";
import { checkBankAccountsRequired } from "./tool-helpers";

export type ToolExecutionOptions = {
  experimental_context?: unknown;
};

export function getToolAppContext(
  executionOptions: ToolExecutionOptions,
): AppContext {
  return executionOptions.experimental_context as AppContext;
}

export function getToolTeamId(appContext: AppContext): string | null {
  const teamId = appContext.teamId;
  return typeof teamId === "string" && teamId.length > 0 ? teamId : null;
}

export function throwIfBankAccountsRequired(appContext: AppContext) {
  const { shouldYield } = checkBankAccountsRequired(appContext);

  if (shouldYield) {
    throw new Error("BANK_ACCOUNT_REQUIRED");
  }
}

export function resolveReportToolParams(
  options: Omit<ResolveToolParamsOptions, "appContext"> & {
    appContext: AppContext;
  },
) {
  const resolved = resolveToolParams(options);

  return {
    resolved,
    finalFrom: resolved.from,
    finalTo: resolved.to,
    finalCurrency: resolved.currency,
    description: generateArtifactDescription(resolved.from, resolved.to),
    locale: options.appContext.locale || "en-US",
  };
}

export function startArtifactStream<TArtifactInput, TArtifactStream>(options: {
  enabled: boolean;
  executionOptions: ToolExecutionOptions;
  artifact: {
    stream: (
      input: TArtifactInput,
      writer: ReturnType<typeof getWriter>,
    ) => TArtifactStream;
  };
  input: TArtifactInput;
}): TArtifactStream | undefined {
  if (!options.enabled) {
    return undefined;
  }

  return options.artifact.stream(
    options.input,
    getWriter(options.executionOptions),
  );
}
