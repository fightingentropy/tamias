"use client";

import type { AppRouter } from "@tamias/trpc";
import { getApiUrl } from "@tamias/utils/envs";
import type { QueryClient } from "@tanstack/react-query";
import { isServer, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, loggerLink, TRPCUntypedClient } from "@trpc/client";
import {
  createTRPCOptionsProxy,
  type TRPCOptionsProxy,
} from "@trpc/tanstack-react-query";
import { createContext, useContext, useMemo } from "react";
import superjson from "superjson";
import { useAuthToken } from "@/framework/auth-client";
import { makeQueryClient } from "./query-client";

const TRPCContext = createContext<TRPCOptionsProxy<AppRouter> | null>(null);
const apiUrl = getApiUrl();
const trpcBrowserConsole = {
  log: (...args: unknown[]) => console.log(...args),
  warn: (...args: unknown[]) => console.warn(...args),
};

export function useTRPC() {
  const trpc = useContext(TRPCContext);

  if (!trpc) {
    throw new Error("useTRPC() can only be used inside of a TRPCReactProvider");
  }

  return trpc;
}

let browserQueryClient: QueryClient;

function getQueryClient() {
  if (isServer) {
    return makeQueryClient();
  }

  if (!browserQueryClient) browserQueryClient = makeQueryClient();

  return browserQueryClient;
}

export function TRPCReactProvider(
  props: Readonly<{
    children: React.ReactNode;
  }>,
) {
  const queryClient = getQueryClient();
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
              process.env.NODE_ENV === "development" && opts.direction === "up",
          }),
          httpBatchLink({
            url: `${apiUrl}/trpc`,
            transformer: superjson,
            fetch,
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
