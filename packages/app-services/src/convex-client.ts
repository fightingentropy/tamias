import { ConvexHttpClient } from "convex/browser";

let sharedConvexClient: ConvexHttpClient | null = null;
let sharedConvexClientUrl: string | null = null;

export function getConvexUrl() {
  return (
    process.env.CONVEX_URL ||
    process.env.TAMIAS_CONVEX_URL ||
    process.env.CONVEX_SITE_URL
  );
}

export function createConvexClient() {
  const convexUrl = getConvexUrl();

  if (!convexUrl) {
    throw new Error("Missing CONVEX_URL");
  }

  return new ConvexHttpClient(convexUrl, { logger: false });
}

export function getSharedConvexClient() {
  const convexUrl = getConvexUrl();

  if (!convexUrl) {
    throw new Error("Missing CONVEX_URL");
  }

  if (!sharedConvexClient || sharedConvexClientUrl !== convexUrl) {
    sharedConvexClient = new ConvexHttpClient(convexUrl, { logger: false });
    sharedConvexClientUrl = convexUrl;
  }

  return sharedConvexClient;
}

export function getConvexServiceKey() {
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
