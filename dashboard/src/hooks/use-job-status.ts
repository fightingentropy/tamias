"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";

type UseJobStatusProps = {
  /** Opaque async run ID */
  runId?: string;
  enabled?: boolean;
};

const MIN_POLL_INTERVAL = 3_000;
const MAX_POLL_INTERVAL = 30_000;

/**
 * Compute polling interval with exponential backoff.
 * Starts at 3s, doubles each time, caps at 30s.
 */
function getBackoffInterval(fetchCount: number): number {
  const interval = MIN_POLL_INTERVAL * 2 ** Math.max(0, fetchCount - 1);
  return Math.min(interval, MAX_POLL_INTERVAL);
}

/**
 * Hook for polling async run status through the API.
 * Uses exponential backoff (3s → 6s → 12s → 24s → 30s cap)
 * to reduce unnecessary requests for long-running jobs.
 */
export function useJobStatus({ runId, enabled = true }: UseJobStatusProps = {}) {
  const trpc = useTRPC();
  const shouldQuery = enabled && !!runId;
  const query = useQuery({
    ...trpc.asyncRuns.currentUserRun.queryOptions({
      runId: runId ?? "",
    }),
    enabled: shouldQuery,
    refetchInterval: (currentQuery) => {
      const status = currentQuery.state.data?.status;

      if (!shouldQuery || !status) {
        return false;
      }

      if (status === "completed" || status === "failed" || status === "canceled") {
        return false;
      }

      return getBackoffInterval(currentQuery.state.dataUpdateCount);
    },
    refetchOnWindowFocus: false,
  });
  const currentRun = query.data;

  const isLoading = shouldQuery && currentRun === undefined;
  const queryError =
    shouldQuery && currentRun === null
      ? new Error("Run not found or access denied")
      : (query.error ?? undefined);

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
