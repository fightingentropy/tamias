import { useEffect, useState } from "react";
import { useJobStatus } from "@/hooks/use-job-status";

type UseInitialConnectionStatusProps = {
  runId?: string;
};

export function useInitialConnectionStatus({
  runId: initialRunId,
}: UseInitialConnectionStatusProps) {
  const [runId, setRunId] = useState<string | undefined>(initialRunId);
  const [status, setStatus] = useState<
    "FAILED" | "SYNCING" | "COMPLETED" | null
  >(null);

  const { status: runStatus, queryError } = useJobStatus({
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
  };
}
