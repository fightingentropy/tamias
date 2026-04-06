import { useEffect, useState } from "react";
import { useJobStatus } from "@/hooks/use-job-status";

type UseSyncStatusProps = {
  runId?: string;
};

export function useSyncStatus({
  runId: initialRunId,
}: UseSyncStatusProps) {
  const [runId, setRunId] = useState<string | undefined>(initialRunId);
  const [status, setStatus] = useState<
    "FAILED" | "SYNCING" | "COMPLETED" | null
  >(null);
  const { status: runStatus, result, queryError } = useJobStatus({
    runId,
    enabled: !!runId,
  });

  useEffect(() => {
    if (initialRunId) {
      setRunId(initialRunId);
      setStatus("SYNCING");
    }
  }, [initialRunId]);

  useEffect(() => {
    if (queryError || runStatus === "failed" || runStatus === "canceled") {
      setStatus("FAILED");
    }

    if (runStatus === "completed") {
      setStatus("COMPLETED");
    }
  }, [queryError, runStatus]);

  return {
    status,
    setStatus,
    result,
  };
}
