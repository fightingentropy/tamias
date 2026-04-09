"use client";

import { useQueryClient } from "@tanstack/react-query";
import { endOfDay, startOfDay, subDays } from "date-fns";
import { useCallback, useRef } from "react";
import { useTRPC } from "@/trpc/client";

/**
 * Returns a prefetch handler for sidebar navigation links.
 * When the user hovers a nav link, the primary query for that route is
 * prefetched into the React Query cache so data is ready on click.
 *
 * Prefetches are deduped: each route is prefetched at most once per mount.
 */
export function useNavPrefetch() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const prefetched = useRef(new Set<string>());

  const prefetchRoute = useCallback(
    (path: string) => {
      if (prefetched.current.has(path)) return;
      prefetched.current.add(path);

      const route = path.split("?")[0] ?? path;

      // Prefetch the primary query for each route. Uses fire-and-forget
      // (errors are silently ignored) so a failed prefetch never blocks nav.
      switch (route) {
        case "/invoices":
          void queryClient.prefetchQuery(
            trpc.widgets.getOutstandingInvoices.queryOptions({}),
          );
          break;
        case "/inbox":
          void queryClient.prefetchQuery(
            trpc.widgets.getInboxStats.queryOptions({
              from: startOfDay(subDays(new Date(), 7)).toISOString(),
              to: endOfDay(new Date()).toISOString(),
            }),
          );
          break;
        case "/dashboard":
          void queryClient.prefetchQuery(
            trpc.widgets.getAccountBalances.queryOptions({}),
          );
          break;
      }
    },
    [queryClient, trpc],
  );

  return prefetchRoute;
}
