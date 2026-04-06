"use client";

import { toast } from "@tamias/ui/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useAuthToken } from "@/framework/auth-client";
import { useJobStatus } from "@/hooks/use-job-status";
import {
  BANK_INITIAL_SYNC_RUN_PERSIST_EVENT,
  clearBankInitialSyncRunId,
  readBankInitialSyncRunId,
} from "@/lib/bank-initial-sync-run";
import { useTRPC } from "@/trpc/client";

/**
 * After bank connect, users can close the modal while `bank-initial-setup` still runs.
 * `LoadingTransactionsEvent` unmounts, so nothing invalidated the transactions query.
 * Persist the workflow run id and finish invalidation from the app root.
 */
export function BankInitialSyncRecovery() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  const [runId, setRunId] = useState<string | undefined>();
  const handledRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const sync = () => {
      setRunId(readBankInitialSyncRunId());
    };
    sync();
    window.addEventListener(BANK_INITIAL_SYNC_RUN_PERSIST_EVENT, sync);
    return () => window.removeEventListener(BANK_INITIAL_SYNC_RUN_PERSIST_EVENT, sync);
  }, []);

  const enabled = !!runId && !!token;
  const { status, queryError } = useJobStatus({
    runId,
    enabled,
  });

  useEffect(() => {
    if (!runId || !enabled) {
      return;
    }

    const failed = queryError != null || status === "failed" || status === "canceled";
    if (failed) {
      const key = `fail:${runId}`;
      if (handledRef.current.has(key)) {
        return;
      }
      handledRef.current.add(key);
      clearBankInitialSyncRunId();
      setRunId(undefined);
      toast({
        variant: "error",
        title: "Bank setup did not finish",
        description:
          "In local dev, ensure the API can reach your Cloudflare worker/bridge so the sync job can run. You can try connecting again.",
      });
      return;
    }

    if (status === "completed") {
      const key = `ok:${runId}`;
      if (handledRef.current.has(key)) {
        return;
      }
      handledRef.current.add(key);
      clearBankInitialSyncRunId();
      setRunId(undefined);
      void queryClient.invalidateQueries({ queryKey: trpc.transactions.get.infiniteQueryKey() });
      void queryClient.invalidateQueries({ queryKey: trpc.transactions.getReviewCount.queryKey() });
      void queryClient.invalidateQueries({ queryKey: trpc.bankConnections.get.queryKey() });
    }
  }, [enabled, queryClient, queryError, runId, status, trpc]);

  return null;
}
