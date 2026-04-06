import { createFileRoute } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start";
import { createAppFileRoute } from "@/start/route-hosts";

export const loadReportsData = createServerFn({ method: "GET" })
  .inputValidator((data: { href: string }) => data)
  .handler(async ({ data }) => {
    const { buildReportsPageData } = await import("@/start/server/route-data/reports");
    return await buildReportsPageData(data.href);
  });

export type ReportsLoaderData = Awaited<ReturnType<typeof loadReportsData>>;

export const Route = createAppFileRoute("/reports")({
  loader: ({ location }) => loadReportsData({ data: { href: location.href } }),
  head: () => ({
    meta: [{ title: "Reports | Tamias" }],
  }),
});
