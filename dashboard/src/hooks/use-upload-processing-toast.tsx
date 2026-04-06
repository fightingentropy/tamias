"use client";

import { toast } from "@tamias/ui/use-toast";
import NumberFlow from "@number-flow/react";
import { useQueries } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";
import { PROCESSING_TOAST_ID } from "@/components/transactions-upload-zone";
import { useMatchSound } from "@/hooks/use-match-sound";
import { usePendingUploadsStore } from "@/store/pending-uploads";
import { useTRPC } from "@/trpc/client";

// Terminal statuses that indicate processing is truly complete
// Note: "pending" is NOT terminal - items can go pending → analyzing → suggested_match
const TERMINAL_STATUSES = new Set(["suggested_match", "done", "deleted"]);

type UseUploadProcessingToastOptions = {
  teamId?: string;
  onStatusChange?: () => void;
};

type InboxStatusItem = {
  id: string;
  status?: string | null;
};

/**
 * Hook that handles upload processing feedback via toast notifications.
 * - Tracks pending uploads from the store
 * - Subscribes to realtime inbox status changes
 * - Shows toast progress as matches are found
 * - Finalizes with success message when all items complete
 * - Falls back to completion after 30s timeout
 */
export function useUploadProcessingToast({
  teamId,
  onStatusChange,
}: UseUploadProcessingToastOptions) {
  const trpc = useTRPC();
  const {
    pendingIds,
    totalCount,
    markComplete,
    reset: resetPendingUploads,
    getState,
  } = usePendingUploadsStore();
  const { play: playMatchSound } = useMatchSound();
  const previousStatusesRef = useRef(new Map<string, string | null>());
  const pendingIdList = Object.keys(pendingIds);

  // Finalize toast with current match count
  const finalizeToast = useCallback(
    (matchCount: number) => {
      if (matchCount > 0) {
        toast({
          id: PROCESSING_TOAST_ID,
          title: (
            <span className="flex items-center gap-1">
              <NumberFlow value={matchCount} willChange /> receipt
              {matchCount !== 1 ? "s" : ""} matched
            </span>
          ) as unknown as string,
          description: "Review suggested matches in your transactions",
          variant: "success",
          duration: 5000,
        });
      } else {
        toast({
          id: PROCESSING_TOAST_ID,
          title: "Processing complete",
          description: "No matching transactions found",
          variant: "success",
          duration: 3000,
        });
      }
      resetPendingUploads();
    },
    [resetPendingUploads],
  );

  const pendingInboxQueries = useQueries({
    queries: pendingIdList.map((id) => ({
      ...trpc.inbox.getById.queryOptions({ id }),
      enabled: Boolean(teamId),
      refetchInterval: 3_000,
      staleTime: 0,
    })),
  });

  useEffect(() => {
    const activeIds = new Set(pendingIdList);

    for (const id of previousStatusesRef.current.keys()) {
      if (!activeIds.has(id)) {
        previousStatusesRef.current.delete(id);
      }
    }

    for (const query of pendingInboxQueries) {
      const item = query.data as InboxStatusItem | undefined;

      if (!item?.id) {
        continue;
      }

      const newStatus = item.status ?? null;
      const oldStatus = previousStatusesRef.current.get(item.id) ?? null;

      if (
        newStatus &&
        TERMINAL_STATUSES.has(newStatus) &&
        !TERMINAL_STATUSES.has(oldStatus ?? "")
      ) {
        const isMatch = newStatus === "suggested_match";
        if (isMatch) {
          playMatchSound();
        }
        markComplete(item.id, isMatch);
        onStatusChange?.();
      } else if (newStatus === "done" && oldStatus !== "done") {
        onStatusChange?.();
      }

      previousStatusesRef.current.set(item.id, newStatus);
    }
  }, [
    markComplete,
    onStatusChange,
    pendingIdList,
    pendingInboxQueries,
    playMatchSound,
  ]);

  // Timeout ref for fallback completion
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check completion and update toast when store state changes
  useEffect(() => {
    const { isAllComplete, hasPending, matchCount } = getState();

    if (!hasPending) {
      // Clear timeout when no pending uploads
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }

    // Clear any existing timeout when state changes
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (isAllComplete) {
      finalizeToast(matchCount);
    } else {
      // Show progress if we have matches
      if (matchCount > 0) {
        toast({
          id: PROCESSING_TOAST_ID,
          title: (
            <span className="flex items-center gap-1">
              <NumberFlow value={matchCount} willChange /> receipt
              {matchCount !== 1 ? "s" : ""} matched...
            </span>
          ) as unknown as string,
          description: "Looking for more matches",
          variant: "spinner",
          duration: Number.POSITIVE_INFINITY,
        });
      }

      // Set timeout fallback: finalize after 30s of no completion
      timeoutRef.current = setTimeout(() => {
        const currentState = getState();
        if (currentState.hasPending && !currentState.isAllComplete) {
          finalizeToast(currentState.matchCount);
        }
      }, 30000);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [pendingIds, totalCount, getState, finalizeToast]);
}
