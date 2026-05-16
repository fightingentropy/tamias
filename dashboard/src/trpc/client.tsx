"use client";

import type { AppRouter } from "@tamias/trpc";
import { getDashboardApiUrl } from "@/env/dashboard-api-url";
import { QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, loggerLink, TRPCUntypedClient } from "@trpc/client";
import { createTRPCOptionsProxy, type TRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { createContext, useContext, useMemo } from "react";
import superjson from "superjson";
import { useAuthToken } from "@/framework/auth-client";
import { getBrowserAwareQueryClient } from "./browser-query-client";

const TRPCContext = createContext<TRPCOptionsProxy<AppRouter> | null>(null);
const apiUrl = getDashboardApiUrl();
const trpcBrowserConsole = {
  log: (...args: unknown[]) => console.log(...args),
  warn: (...args: unknown[]) => console.warn(...args),
};

async function trpcFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, init);
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return response;
  }

  const status = response.ok ? 502 : response.status;

  return new Response(
    JSON.stringify({
      error: {
        json: {
          message: `Upstream non-JSON response: HTTP ${response.status}`,
          code: -32603,
          data: { code: "INTERNAL_SERVER_ERROR", httpStatus: status },
        },
      },
    }),
    {
      status,
      headers: { "content-type": "application/json" },
    },
  );
}

export function useTRPC() {
  const trpc = useContext(TRPCContext);

  if (!trpc) {
    throw new Error("useTRPC() can only be used inside of a TRPCReactProvider");
  }

  return trpc;
}

export function TRPCReactProvider(
  props: Readonly<{
    children: React.ReactNode;
  }>,
) {
  const queryClient = getBrowserAwareQueryClient();
  const token = useAuthToken();

  const trpcClient = useMemo(
    () =>
      new TRPCUntypedClient<AppRouter>({
        links: [
          loggerLink({
            console: {
              log: (...args) => trpcBrowserConsole.log(...args),
              error: (...args) => trpcBrowserConsole.warn(...args),
            },
            enabled: (opts) =>
              process.env.NODE_ENV === "development" &&
              opts.direction === "up" &&
              opts.path !== "asyncRuns.currentUserRun",
          }),
          httpBatchLink({
            url: `${apiUrl}/trpc`,
            transformer: superjson,
            fetch: trpcFetch,
            headers() {
              const headers: Record<string, string> = {};

              if (token) {
                headers.Authorization = `Bearer ${token}`;
              }

              return headers;
            },
          }),
        ],
      }),
    [token],
  );

  const trpc = useMemo(
    () =>
      createTRPCOptionsProxy<AppRouter>({
        client: trpcClient,
        queryClient,
      }),
    [trpcClient, queryClient],
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCContext.Provider value={trpc}>{props.children}</TRPCContext.Provider>
    </QueryClientProvider>
  );
}
