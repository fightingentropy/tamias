import { ConvexError } from "convex/values";

export function getConfiguredServiceKey() {
  return process.env.CONVEX_SERVICE_KEY;
}

export function requireServiceKey(serviceKey: string) {
  const configuredKey = getConfiguredServiceKey();
  const deployment = process.env.CONVEX_DEPLOYMENT;

  if (!configuredKey && deployment?.startsWith("local:")) {
    if (serviceKey === "local-dev") {
      return;
    }
  }

  if (!configuredKey) {
    throw new ConvexError("CONVEX_SERVICE_KEY is not configured");
  }

  if (serviceKey !== configuredKey) {
    throw new ConvexError("Forbidden");
  }
}
