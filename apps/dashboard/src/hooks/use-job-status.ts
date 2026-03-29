"use client";

import { api } from "@tamias/convex-model/api";
import { useQuery as useConvexQuery } from "convex/react";

type UseJobStatusProps = {
  /** Opaque async run ID */
  runId?: string;
  enabled?: boolean;
};

/**
 * Hook for subscribing to async run status via Convex.
 */
export function useJobStatus({
  runId,
  enabled = true,
}: UseJobStatusProps = {}) {
  const shouldQuery = enabled && !!runId;
  const currentRun = useConvexQuery(
    api.asyncRuns.currentUserRun,
    shouldQuery ? { runId: runId! } : "skip",
  );

  const isLoading = shouldQuery && currentRun === undefined;
  const queryError =
    shouldQuery && currentRun === null
      ? new Error("Run not found or access denied")
      : undefined;

  return {
    status: currentRun?.status,
    progress: currentRun?.progress,
    progressStep: currentRun?.progressStep,
    result: currentRun?.result,
    error: currentRun?.error,
    isLoading,
    queryError,
  };
}
