"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef } from "react";
import { useForesight } from "@/hooks/use-foresight";
import { useMetricsFilter } from "@/hooks/use-metrics-filter";
import { prefetchSearchModule } from "@/lib/search-module";
import { useTRPC } from "@/trpc/client";

/**
 * Hook for predictive data prefetching using ForesightJS.
 * Prefetches data when cursor trajectory indicates user is heading toward an element.
 */

// Module-level constants to avoid creating new object references on each render
// (useForesight includes hitSlop in its dependency array)
const METRICS_HIT_SLOP = { top: 100, right: 100, bottom: 100, left: 100 };
const CHAT_HIT_SLOP = { top: 150, right: 150, bottom: 150, left: 150 };
const SEARCH_HIT_SLOP = { top: 100, right: 100, bottom: 100, left: 100 };

type NetworkInformationLike = {
  saveData?: boolean;
  effectiveType?: string;
};

type WindowWithIdleCallback = Window & {
  requestIdleCallback?: (
    callback: (deadline: { didTimeout: boolean; timeRemaining(): number }) => void,
    options?: { timeout?: number },
  ) => number;
};

function getConnectionInfo() {
  if (typeof navigator === "undefined") {
    return null;
  }

  const connection =
    (
      navigator as Navigator & {
        connection?: NetworkInformationLike;
        mozConnection?: NetworkInformationLike;
        webkitConnection?: NetworkInformationLike;
      }
    ).connection ??
    (
      navigator as Navigator & {
        connection?: NetworkInformationLike;
        mozConnection?: NetworkInformationLike;
        webkitConnection?: NetworkInformationLike;
      }
    ).mozConnection ??
    (
      navigator as Navigator & {
        connection?: NetworkInformationLike;
        mozConnection?: NetworkInformationLike;
        webkitConnection?: NetworkInformationLike;
      }
    ).webkitConnection ??
    null;

  return connection;
}

function isPredictivePrefetchAllowed() {
  const connection = getConnectionInfo();

  if (!connection) {
    return true;
  }

  if (connection.saveData) {
    return false;
  }

  return connection.effectiveType !== "slow-2g" && connection.effectiveType !== "2g";
}

function schedulePredictivePrefetch(task: () => void) {
  if (!isPredictivePrefetchAllowed()) {
    return;
  }

  if (typeof window !== "undefined") {
    const windowWithIdleCallback = window as WindowWithIdleCallback;

    if (windowWithIdleCallback.requestIdleCallback) {
      windowWithIdleCallback.requestIdleCallback(
        () => {
          task();
        },
        { timeout: 1500 },
      );
      return;
    }
  }

  setTimeout(() => {
    task();
  }, 50);
}

/**
 * Prefetch metrics data when cursor heads toward Metrics tab
 */
export function useForesightMetricsPrefetch() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { from, to, currency, revenueType } = useMetricsFilter();
  const hasPrefetched = useRef(false);

  const prefetchMetrics = useCallback(() => {
    if (hasPrefetched.current) return;
    hasPrefetched.current = true;

    schedulePredictivePrefetch(async () => {
      const prefetchers = [
        () =>
          queryClient.prefetchQuery(
            trpc.reports.revenue.queryOptions({
              from,
              to,
              currency,
              revenueType,
            }),
          ),
        () => queryClient.prefetchQuery(trpc.reports.expense.queryOptions({ from, to, currency })),
        () =>
          queryClient.prefetchQuery(
            trpc.reports.profit.queryOptions({
              from,
              to,
              currency,
              revenueType,
            }),
          ),
        () => queryClient.prefetchQuery(trpc.reports.runway.queryOptions({ currency })),
        () => queryClient.prefetchQuery(trpc.widgets.getAccountBalances.queryOptions({ currency })),
      ];

      for (const prefetch of prefetchers) {
        await prefetch();
      }
    });
  }, [queryClient, trpc, from, to, currency, revenueType]);

  const { elementRef } = useForesight<HTMLButtonElement>({
    callback: prefetchMetrics,
    name: "metrics-tab",
    hitSlop: METRICS_HIT_SLOP,
  });

  return { elementRef, prefetchMetrics };
}

/**
 * Prefetch chat history when cursor heads toward chat input area
 */
export function useForesightChatPrefetch() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const hasPrefetched = useRef(false);

  const prefetchChatData = useCallback(() => {
    if (hasPrefetched.current) return;
    hasPrefetched.current = true;

    schedulePredictivePrefetch(() => {
      // Prefetch chat history - must match ChatHistoryDropdown query params exactly
      void queryClient.prefetchQuery(
        trpc.chats.list.queryOptions({
          limit: 20,
          search: undefined,
        }),
      );
    });
  }, [queryClient, trpc]);

  const { elementRef } = useForesight<HTMLButtonElement>({
    callback: prefetchChatData,
    name: "chat-input",
    hitSlop: CHAT_HIT_SLOP,
  });

  return { elementRef, prefetchChatData };
}

/**
 * Prefetch search data when cursor heads toward search button
 */
export function useForesightSearchPrefetch() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const predictivePrefetchAttempted = useRef(false);
  const searchPrefetchCompleted = useRef(false);

  const prefetchSearchData = useCallback(() => {
    if (searchPrefetchCompleted.current) return;
    searchPrefetchCompleted.current = true;

    prefetchSearchModule();

    // Prefetch global search with empty query to warm up the cache
    void queryClient.prefetchQuery(
      trpc.search.global.queryOptions({
        searchTerm: "",
      }),
    );
  }, [queryClient, trpc]);

  const prefetchSearchDataPredictive = useCallback(() => {
    if (predictivePrefetchAttempted.current || searchPrefetchCompleted.current) {
      return;
    }

    predictivePrefetchAttempted.current = true;

    schedulePredictivePrefetch(() => {
      if (searchPrefetchCompleted.current) {
        return;
      }

      searchPrefetchCompleted.current = true;
      prefetchSearchModule();

      void queryClient.prefetchQuery(
        trpc.search.global.queryOptions({
          searchTerm: "",
        }),
      );
    });
  }, [queryClient, trpc]);

  const { elementRef } = useForesight<HTMLButtonElement>({
    callback: prefetchSearchDataPredictive,
    name: "search-button",
    hitSlop: SEARCH_HIT_SLOP,
  });

  return { elementRef, prefetchSearchData };
}
