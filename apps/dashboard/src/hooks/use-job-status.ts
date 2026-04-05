"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";

type UseJobStatusProps = {
  /** Opaque async run ID */
  runId?: string;
  enabled?: boolean;
};

/**
 * Hook for polling async run status through the API.
 */
export function useJobStatus({
  runId,
  enabled = true,
}: UseJobStatusProps = {}) {
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

      if (
        status === "completed" ||
        status === "failed" ||
        status === "canceled"
      ) {
        return false;
      }

      return 1_500;
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
