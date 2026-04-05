import { createFileRoute } from "@tanstack/react-router"
import { createAppFileRoute } from "@/start/route-hosts";
import { createServerFn } from "@tanstack/react-start";

export const loadAppsData = createServerFn({ method: "GET" }).handler(async () => {
  const { buildAppsPageData } = await import("@/start/server/route-data/apps");
  return (await buildAppsPageData());
});

export type AppsLoaderData = Awaited<ReturnType<typeof loadAppsData>>;

export const Route = createAppFileRoute("/apps")({
  loader: () => loadAppsData(),
  head: () => ({
    meta: [{ title: "Apps | Tamias" }],
  }),
});
