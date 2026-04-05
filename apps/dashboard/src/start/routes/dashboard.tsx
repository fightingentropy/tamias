import { createFileRoute } from "@tanstack/react-router"
import { createAppFileRoute } from "@/start/route-hosts";
import { createServerFn } from "@tanstack/react-start";

export const loadDashboardData = createServerFn({ method: "GET" })
  .inputValidator((data: { href: string }) => data)
  .handler(async ({ data }) => {
    const { buildDashboardPageData } = await import(
      "@/start/server/route-data/dashboard"
    );
    return (await buildDashboardPageData(data.href)) as any;
  });

export type DashboardLoaderData = Awaited<ReturnType<typeof loadDashboardData>>;

export const Route = createAppFileRoute("/dashboard")({
  loader: ({ location }) => loadDashboardData({ data: { href: location.href } }),
  head: () => ({
    meta: [{ title: "Dashboard | Tamias" }],
  }),
});
