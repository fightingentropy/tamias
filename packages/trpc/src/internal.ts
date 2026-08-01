import type { AppRouter } from "@tamias/api/trpc/routers/_app.types";
import {
  createServiceIdentityTokenFromEnvironment,
  SERVICE_AUTH_HEADER,
} from "@tamias/auth-session/service-identity";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { fetchWithRetry } from "./fetch-with-retry";

/**
 * Create a tRPC client for internal service-to-service calls.
 * Authenticates with a short-lived, scoped service identity token.
 */
export function createInternalClient() {
  const apiUrl = process.env.API_INTERNAL_URL || process.env.API_URL || "http://localhost:3001";

  const trpcUrl = `${apiUrl}/trpc`;

  if (!process.env.API_INTERNAL_URL && !process.env.API_URL) {
    console.warn(
      `[trpc-internal] Neither API_INTERNAL_URL nor API_URL is set, falling back to ${trpcUrl}`,
    );
  }

  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: trpcUrl,
        transformer: superjson,
        fetch: fetchWithRetry,
        async headers() {
          return {
            [SERVICE_AUTH_HEADER]: `Bearer ${await createServiceIdentityTokenFromEnvironment("api")}`,
          };
        },
      }),
    ],
  });
}

/**
 * Pre-configured internal tRPC client singleton.
 * Import this directly in jobs and workers.
 */
let _client: ReturnType<typeof createInternalClient> | null = null;

export function getInternalClient() {
  if (!_client) {
    _client = createInternalClient();
  }
  return _client;
}
