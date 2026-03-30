import { api as convexModelApi } from "@tamias/convex-model/api";
import type { Id } from "@tamias/convex-model/data-model";
import { ConvexHttpClient } from "convex/browser";

export const api = convexModelApi;
export const convexApi = api as typeof api & Record<string, any>;

let sharedConvexClient: ConvexHttpClient | null = null;
let sharedConvexClientUrl: string | null = null;

export type ConvexUserId = Id<"appUsers">;
export type ConvexTeamId = Id<"teams">;

function getConvexUrl() {
  return (
    process.env.CONVEX_URL ||
    process.env.NEXT_PUBLIC_CONVEX_URL ||
    process.env.CONVEX_SITE_URL
  );
}

function getServiceKey() {
  const configuredKey = process.env.CONVEX_SERVICE_KEY;

  if (configuredKey) {
    return configuredKey;
  }

  const convexUrl = getConvexUrl();

  if (convexUrl?.includes("127.0.0.1") || convexUrl?.includes("localhost")) {
    return "local-dev";
  }

  throw new Error("Missing CONVEX_SERVICE_KEY");
}

export function createClient() {
  const convexUrl = getConvexUrl();

  if (!convexUrl) {
    throw new Error("Missing CONVEX_URL or NEXT_PUBLIC_CONVEX_URL");
  }

  if (!sharedConvexClient || sharedConvexClientUrl !== convexUrl) {
    sharedConvexClient = new ConvexHttpClient(convexUrl, { logger: false });
    sharedConvexClientUrl = convexUrl;
  }

  return sharedConvexClient;
}

export function serviceArgs<T extends Record<string, unknown>>(args: T) {
  return {
    serviceKey: getServiceKey(),
    ...args,
  };
}
