import { ConvexHttpClient } from "convex/browser";
import { api } from "@tamias/convex-model/api";

export type AsyncRunProvider =
  | "cloudflare-queue"
  | "cloudflare-workflow"
  | "cloudflare-schedule";
export type AsyncRunKind = "job" | "workflow" | "schedule";
export type AsyncRunStatus =
  | "waiting"
  | "active"
  | "completed"
  | "failed"
  | "delayed"
  | "canceled"
  | "unknown";

export type AsyncRunRecord = {
  id: string;
  teamId: string | null;
  appUserId: string | null;
  provider: AsyncRunProvider;
  kind: AsyncRunKind;
  providerRunId: string | null;
  providerQueueName: string | null;
  providerJobName: string | null;
  status: AsyncRunStatus;
  progress: number | null;
  progressStep: string | null;
  result: unknown;
  error: string | null;
  metadata: unknown;
  startedAt: string | null;
  completedAt: string | null;
  canceledAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type CreateAsyncRunInput = {
  publicRunId?: string;
  publicTeamId?: string;
  appUserId?: string;
  provider: AsyncRunProvider;
  kind: AsyncRunKind;
  providerRunId?: string;
  providerQueueName?: string;
  providerJobName?: string;
  status?: AsyncRunStatus;
  progress?: number;
  progressStep?: string;
  result?: unknown;
  error?: string;
  metadata?: unknown;
  startedAt?: string;
  completedAt?: string;
  canceledAt?: string;
};

type UpdateAsyncRunInput = {
  runId: string;
  providerRunId?: string;
  providerQueueName?: string;
  providerJobName?: string;
  status?: AsyncRunStatus;
  progress?: number;
  progressStep?: string;
  result?: unknown;
  error?: string;
  metadata?: unknown;
  startedAt?: string;
  completedAt?: string;
  canceledAt?: string;
};

const convexApi = api as typeof api & {
  asyncRuns: {
    serviceCreateAsyncRun: any;
    serviceGetAsyncRunByPublicRunId: any;
    serviceGetAsyncRunByProviderRunId: any;
    serviceUpdateAsyncRun: any;
  };
};

function getConvexUrl() {
  return (
    process.env.CONVEX_URL ||
    process.env.TAMIAS_CONVEX_URL ||
    process.env.CONVEX_SITE_URL
  );
}

function getServiceKey() {
  const configuredKey = process.env.CONVEX_SERVICE_KEY;

  if (configuredKey) {
    return configuredKey;
  }

  const convexUrl = getConvexUrl();

  if (
    convexUrl?.includes("127.0.0.1") ||
    convexUrl?.includes("localhost")
  ) {
    return "local-dev";
  }

  throw new Error("Missing CONVEX_SERVICE_KEY");
}

function createClient() {
  const convexUrl = getConvexUrl();

  if (!convexUrl) {
    throw new Error("Missing CONVEX_URL");
  }

  return new ConvexHttpClient(convexUrl, { logger: false });
}

function serviceArgs<T extends Record<string, unknown>>(args: T) {
  return {
    serviceKey: getServiceKey(),
    ...args,
  };
}

export function createAsyncRunInConvex(input: CreateAsyncRunInput) {
  return createClient().mutation(
    convexApi.asyncRuns.serviceCreateAsyncRun,
    serviceArgs(input),
  ) as Promise<AsyncRunRecord>;
}

export function getAsyncRunFromConvex(runId: string) {
  return createClient().query(
    convexApi.asyncRuns.serviceGetAsyncRunByPublicRunId,
    serviceArgs({ runId }),
  ) as Promise<AsyncRunRecord | null>;
}

export function getAsyncRunByProviderRunIdFromConvex(
  provider: AsyncRunProvider,
  providerRunId: string,
) {
  return createClient().query(
    convexApi.asyncRuns.serviceGetAsyncRunByProviderRunId,
    serviceArgs({ provider, providerRunId }),
  ) as Promise<AsyncRunRecord | null>;
}

export function updateAsyncRunInConvex(input: UpdateAsyncRunInput) {
  return createClient().mutation(
    convexApi.asyncRuns.serviceUpdateAsyncRun,
    serviceArgs(input),
  ) as Promise<AsyncRunRecord | null>;
}
