import {
  createAsyncRunInConvex,
  getAsyncRunByProviderRunIdFromConvex,
  getAsyncRunFromConvex,
  updateAsyncRunInConvex,
  type AsyncRunRecord,
  type AsyncRunStatus,
} from "@tamias/app-data-convex";
import type { RunStatus, RunStatusResponse } from "./types";

export {
  getAsyncRunByProviderRunIdFromConvex,
  getAsyncRunFromConvex,
  updateAsyncRunInConvex,
};

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

export function extractPublicTeamId(payload: unknown, explicitTeamId?: string) {
  if (explicitTeamId) {
    return explicitTeamId;
  }

  if (
    payload &&
    typeof payload === "object" &&
    "teamId" in payload &&
    typeof payload.teamId === "string"
  ) {
    return payload.teamId;
  }

  return undefined;
}

export function mapCloudflareWorkflowStatus(status: string): RunStatus {
  switch (status) {
    case "queued":
    case "waiting":
    case "paused":
    case "waitingForPause":
      return "waiting";
    case "running":
      return "active";
    case "complete":
      return "completed";
    case "terminated":
      return "canceled";
    case "errored":
      return "failed";
    default:
      return "unknown";
  }
}

export function normalizeStoredRun(run: AsyncRunRecord): RunStatusResponse {
  return {
    status: run.status,
    progress: run.progress ?? undefined,
    progressStep: run.progressStep ?? undefined,
    result: run.result,
    error: run.error ?? undefined,
  };
}

export async function createRunRecord(params: {
  publicTeamId?: string;
  appUserId?: string;
  provider: AsyncRunRecord["provider"];
  kind: AsyncRunRecord["kind"];
  providerRunId?: string;
  status?: AsyncRunStatus;
  providerQueueName?: string;
  providerJobName?: string;
  metadata?: Record<string, unknown>;
}) {
  return createAsyncRunInConvex({
    publicTeamId: params.publicTeamId,
    appUserId: params.appUserId,
    provider: params.provider,
    kind: params.kind,
    providerRunId: params.providerRunId,
    status: params.status,
    providerQueueName: params.providerQueueName,
    providerJobName: params.providerJobName,
    metadata: params.metadata,
  });
}
