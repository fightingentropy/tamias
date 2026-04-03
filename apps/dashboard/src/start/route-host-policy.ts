import { createMemoryHistory } from "@tanstack/history";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "@/start/routeTree.gen";
import type { StartRouteStaticData } from "@/start/route-hosts";

const routeMatcher = createRouter({
  routeTree,
  history: createMemoryHistory({
    initialEntries: ["/"],
  }),
  isServer: true,
});

function isStartRouteStaticData(
  value: unknown,
): value is StartRouteStaticData {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<StartRouteStaticData>;

  return (
    (candidate.hostSurface === "app" ||
      candidate.hostSurface === "website" ||
      candidate.hostSurface === "shared") &&
    (candidate.appHostAccess === "public" ||
      candidate.appHostAccess === "protected")
  );
}

export function getRouteHostPolicy(url: URL): StartRouteStaticData | null {
  const matches = routeMatcher.matchRoutes(url.pathname, {});

  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const staticData = matches[index]?.staticData;

    if (isStartRouteStaticData(staticData)) {
      return staticData;
    }
  }

  return null;
}
