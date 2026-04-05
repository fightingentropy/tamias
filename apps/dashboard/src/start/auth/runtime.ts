import { getConvexUrl } from "@tamias/utils/envs";

function isLocalConvexUrl(convexUrl: string | undefined) {
  return Boolean(
    convexUrl &&
      (convexUrl.includes("127.0.0.1") || convexUrl.includes("localhost")),
  );
}

export function canResolveConvexSessionLocally() {
  if (process.env.CONVEX_SERVICE_KEY) {
    return true;
  }

  return isLocalConvexUrl(getConvexUrl());
}
