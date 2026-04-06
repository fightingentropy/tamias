import { api } from "@tamias/app-data-convex/api";
import type { Id } from "@tamias/app-data-convex/data-model";
import { TRPCError } from "@trpc/server";
import { ConvexHttpClient } from "convex/browser";

export { api };

export type StorageId = Id<"_storage">;

function requireConvexUrl() {
  const convexUrl =
    process.env.CONVEX_URL || process.env.TAMIAS_CONVEX_URL || process.env.CONVEX_SITE_URL;

  if (!convexUrl) {
    throw new Error("Missing CONVEX_URL");
  }

  return convexUrl;
}

export async function withUserConvexClient<T>(
  accessToken: string | null | undefined,
  fn: (client: ConvexHttpClient) => Promise<T>,
) {
  if (!accessToken) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Missing access token",
    });
  }

  const client = new ConvexHttpClient(requireConvexUrl(), { logger: false });
  client.setAuth(accessToken);

  try {
    return await fn(client);
  } finally {
    client.clearAuth();
  }
}
