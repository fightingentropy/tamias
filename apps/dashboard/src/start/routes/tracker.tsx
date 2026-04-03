import { createFileRoute } from "@tanstack/react-router"
import { createAppFileRoute } from "@/start/route-hosts";
import { createServerFn } from "@tanstack/react-start";

export const loadTrackerData = createServerFn({ method: "GET" })
  .inputValidator((data: { href: string }) => data)
  .handler(async ({ data }) => {
    const { buildTrackerPageData } = await import("@/start/server/route-data/app");
    return (await buildTrackerPageData(data.href)) as any;
  });

export type TrackerLoaderData = Awaited<ReturnType<typeof loadTrackerData>>;

export const Route = createAppFileRoute("/tracker")({
  loader: ({ location }) => loadTrackerData({ data: { href: location.href } }),
  head: () => ({
    meta: [{ title: "Tracker | Tamias" }],
  }),
});
