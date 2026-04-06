import type { AppRouter } from "@tamias/trpc";
import { getApiUrl } from "@tamias/utils/envs";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink, loggerLink } from "@trpc/client";
import {
  createTRPCOptionsProxy,
  type TRPCQueryOptions,
} from "@trpc/tanstack-react-query";
import { cache } from "react";
import superjson from "superjson";
import { noteSsrTrpcCall } from "@/server/perf";
import { getApiServiceBinding } from "@/start/server/cloudflare-context";
import { makeQueryClient } from "./query-client";
import {
  buildTRPCRequestHeaders,
  getServerRequestContext,
} from "./request-context";

// IMPORTANT: Create a stable getter for the query client that
//            will return the same client during the same request.
export const getQueryClient = cache(makeQueryClient);

const DEFAULT_TAMIAS_PROD_API_ORIGIN = "https://api.tamias.xyz";

function resolvedApiMatchesProdDefault(url: string): boolean {
  try {
    return (
      new URL(url).origin === new URL(DEFAULT_TAMIAS_PROD_API_ORIGIN).origin
    );
  } catch {
    return false;
  }
}

function resolveDashboardSsrTrpcBaseUrl(): string {
  const internal = process.env.API_INTERNAL_URL;
  if (internal) {
    return internal;
  }

  const fromEnv = getApiUrl();
  // `vite dev` SSR prebundles workspace packages; `process.env.NODE_ENV` there may not match
  // Vite's define. `import.meta.env.DEV` is authoritative for local development.
  if (import.meta.env.DEV && resolvedApiMatchesProdDefault(fromEnv)) {
    return "http://localhost:3003";
  }

  return fromEnv;
}

const API_BASE_URL = resolveDashboardSsrTrpcBaseUrl();

const SSR_FETCH_TIMEOUT_MS = 8_000;

function shouldUseApiServiceBinding(input: RequestInfo | URL) {
  const apiService = getApiServiceBinding();

  if (!apiService) {
    return false;
  }

  const requestUrl = new URL(
    typeof input === "string"
      ? input
      : input instanceof Request
        ? input.url
        : input.toString(),
    API_BASE_URL,
  );
  const apiBaseUrl = new URL(API_BASE_URL);

  return requestUrl.origin === apiBaseUrl.origin;
}

function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const timeoutSignal = AbortSignal.timeout(SSR_FETCH_TIMEOUT_MS);
  const signal = init?.signal
    ? AbortSignal.any([init.signal, timeoutSignal])
    : timeoutSignal;

  const headers = new Headers(init?.headers);

  // Prevent HTTP keep-alive reuse on explicit internal networking to avoid
  // stale instance connections across deploys or local restarts.
  if (process.env.API_INTERNAL_URL) {
    headers.set("Connection", "close");
  }

  noteSsrTrpcCall(typeof input === "string" ? input : input.toString());

  if (shouldUseApiServiceBinding(input)) {
    const apiService = getApiServiceBinding();

    if (!apiService) {
      throw new Error("Missing API service binding");
    }

    return apiService.fetch(new Request(input, { ...init, signal, headers }));
  }

  return fetch(input, { ...init, signal, headers });
}

export const trpc = createTRPCOptionsProxy<AppRouter>({
  queryClient: getQueryClient,
  client: createTRPCClient({
    links: [
      httpBatchLink({
        url: `${API_BASE_URL}/trpc`,
        transformer: superjson,
        fetch: fetchWithTimeout,
        async headers() {
          const requestContext = await getServerRequestContext();
          const trustedSession = requestContext.getTrustedSessionHeaderValue();

          return buildTRPCRequestHeaders({
            token: requestContext.token,
            trustedSession,
            location: requestContext.location,
            traceHeaders: requestContext.traceHeaders,
          });
        },
      }),
      loggerLink({
        enabled: (opts) =>
          process.env.NODE_ENV === "development" ||
          (opts.direction === "down" && opts.result instanceof Error),
      }),
    ],
  }),
});

export function HydrateClient(props: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {props.children}
    </HydrationBoundary>
  );
}

export function prefetch<T extends ReturnType<TRPCQueryOptions<any>>>(
  queryOptions: T,
) {
  const queryClient = getQueryClient();

  if (queryOptions.queryKey[1]?.type === "infinite") {
    return queryClient.prefetchInfiniteQuery(queryOptions as any).catch(() => {
      // Avoid unhandled promise rejections from fire-and-forget prefetches.
    });
  }

  return queryClient.prefetchQuery(queryOptions).catch(() => {
    // Avoid unhandled promise rejections from fire-and-forget prefetches.
  });
}

export function batchPrefetch<T extends ReturnType<TRPCQueryOptions<any>>>(
  queryOptionsArray: T[],
) {
  const queryClient = getQueryClient();
  return Promise.all(
    queryOptionsArray.map((queryOptions) => {
      if (queryOptions.queryKey[1]?.type === "infinite") {
        return queryClient
          .prefetchInfiniteQuery(queryOptions as any)
          .catch(() => {
            // Avoid unhandled promise rejections from fire-and-forget prefetches.
          });
      }

      return queryClient.prefetchQuery(queryOptions).catch(() => {
        // Avoid unhandled promise rejections from fire-and-forget prefetches.
      });
    }),
  );
}

/**
 * Get a tRPC client for server-side API routes
 * Use this when you need to call mutations from API routes (e.g., webhooks, callbacks)
 * For queries, use the `trpc` proxy with `queryOptions` instead
 *
 */
export async function getTRPCClient() {
  const requestContext = await getServerRequestContext();
  const trustedSession = requestContext.getTrustedSessionHeaderValue();

  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: `${API_BASE_URL}/trpc`,
        transformer: superjson,
        fetch: fetchWithTimeout,
        headers: buildTRPCRequestHeaders({
          token: requestContext.token,
          trustedSession,
          location: requestContext.location,
          traceHeaders: requestContext.traceHeaders,
        }),
      }),
    ],
  });
}
