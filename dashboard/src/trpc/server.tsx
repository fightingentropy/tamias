import type { AppRouter } from "@tamias/trpc";
import { getApiUrl } from "@tamias/utils/envs";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink, loggerLink } from "@trpc/client";
import { createTRPCOptionsProxy, type TRPCQueryOptions } from "@trpc/tanstack-react-query";
import { cache } from "react";
import superjson from "superjson";
import { noteSsrTrpcCall } from "@/server/perf";
import { getApiServiceBinding } from "@/start/server/cloudflare-context";
import { makeQueryClient } from "./query-client";
import { buildTRPCRequestHeaders, getServerRequestContext } from "./request-context";

// IMPORTANT: Create a stable getter for the query client that
//            will return the same client during the same request.
export const getQueryClient = cache(makeQueryClient);

function resolveDashboardSsrTrpcBaseUrl(): string {
  const internal = process.env.API_INTERNAL_URL;
  if (internal) {
    return internal;
  }

  if (import.meta.env.DEV) {
    const dash = process.env.DASHBOARD_URL;
    if (dash) {
      try {
        // Unified `vite dev`: tRPC is served on the same origin as the app (path routing).
        // Outbound worker `fetch(https://api.tamias.xyz/...)` is flaky and often surfaces as
        // "Network connection lost"; always talk to the running Miniflare listener instead.
        return new URL(dash).origin;
      } catch {
        /* fall through */
      }
    }

    return "http://localhost:3001";
  }

  return getApiUrl();
}

const API_BASE_URL = resolveDashboardSsrTrpcBaseUrl();

const SSR_FETCH_TIMEOUT_MS = 8_000;

function resolveSsrFetchUrl(input: RequestInfo | URL): string {
  return new URL(
    typeof input === "string" ? input : input instanceof Request ? input.url : input.toString(),
    API_BASE_URL,
  ).toString();
}

function mergeRequestHeaders(base: Headers, override: Headers): Headers {
  const out = new Headers(base);
  override.forEach((value, key) => {
    out.set(key, value);
  });
  return out;
}

function shouldUseInProcessApiGateway(resolvedUrl: string): boolean {
  const apiService = getApiServiceBinding();
  if (!apiService) {
    return false;
  }

  let pathname: string;
  try {
    pathname = new URL(resolvedUrl).pathname;
  } catch {
    return false;
  }

  if (pathname.startsWith("/trpc")) {
    return true;
  }

  try {
    return new URL(resolvedUrl).origin === new URL(API_BASE_URL).origin;
  } catch {
    return false;
  }
}

/**
 * Wrap a fetch response to ensure it always has a JSON body that tRPC can
 * parse. Cloudflare edge errors (522, 502, etc.) return HTML error pages
 * which cause `TRPCClientError: Unexpected token ...` and crash SSR.
 */
function ensureJsonResponse(response: Response): Response {
  const contentType = response.headers.get("content-type") ?? "";
  if (response.ok || contentType.includes("application/json")) {
    return response;
  }

  // Non-JSON error response (e.g. Cloudflare 522 HTML page) — synthesize
  // a tRPC-compatible JSON error so the client can handle it normally.
  return new Response(
    JSON.stringify({
      error: {
        json: {
          message: `Upstream error: HTTP ${response.status}`,
          code: -32603,
          data: { code: "INTERNAL_SERVER_ERROR", httpStatus: response.status },
        },
      },
    }),
    {
      status: response.status,
      headers: { "content-type": "application/json" },
    },
  );
}

function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const timeoutSignal = AbortSignal.timeout(SSR_FETCH_TIMEOUT_MS);
  const signal = init?.signal ? AbortSignal.any([init.signal, timeoutSignal]) : timeoutSignal;

  const headers = new Headers(init?.headers);

  // Prevent HTTP keep-alive reuse on explicit internal networking to avoid
  // stale instance connections across deploys or local restarts.
  if (process.env.API_INTERNAL_URL) {
    headers.set("Connection", "close");
  }

  const resolvedUrl = resolveSsrFetchUrl(input);
  noteSsrTrpcCall(resolvedUrl);

  if (shouldUseInProcessApiGateway(resolvedUrl)) {
    const apiService = getApiServiceBinding();

    if (!apiService) {
      throw new Error("Missing API service binding");
    }

    const subrequest =
      input instanceof Request
        ? new Request(resolvedUrl, {
            method: input.method,
            headers: mergeRequestHeaders(input.headers, headers),
            body: input.body,
            signal,
            duplex: "half",
          } as RequestInit)
        : new Request(resolvedUrl, { ...init, signal, headers });

    return apiService.fetch(subrequest).then(ensureJsonResponse);
  }

  const outbound =
    input instanceof Request
      ? new Request(resolvedUrl, {
          method: input.method,
          headers: mergeRequestHeaders(input.headers, headers),
          body: input.body,
          signal,
          duplex: "half",
        } as RequestInit)
      : new Request(resolvedUrl, { ...init, signal, headers });

  return fetch(outbound).then(ensureJsonResponse);
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

  return <HydrationBoundary state={dehydrate(queryClient)}>{props.children}</HydrationBoundary>;
}

export function prefetch<T extends ReturnType<TRPCQueryOptions<any>>>(queryOptions: T) {
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

export function batchPrefetch<T extends ReturnType<TRPCQueryOptions<any>>>(queryOptionsArray: T[]) {
  const queryClient = getQueryClient();
  return Promise.all(
    queryOptionsArray.map((queryOptions) => {
      if (queryOptions.queryKey[1]?.type === "infinite") {
        return queryClient.prefetchInfiniteQuery(queryOptions as any).catch(() => {
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
