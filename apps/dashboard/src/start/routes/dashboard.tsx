import { Provider as ChatProvider } from "@ai-sdk-tools/store";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { AppLayoutShell } from "@/start/components/app-layout-shell";
import { DeferredHomeChat } from "@/components/chat/deferred-home-chat";
import { Widgets } from "@/components/widgets";

const loadDashboardData = createServerFn({ method: "GET" })
  .inputValidator((data: { href: string }) => data)
  .handler(async ({ data }) => {
    const { buildDashboardPageData } = await import("@/start/server/route-data");
    return (await buildDashboardPageData(data.href)) as any;
  });

export const Route = createFileRoute("/dashboard")({
  loader: ({ location }) => loadDashboardData({ data: { href: location.href } }),
  head: () => ({
    meta: [{ title: "Dashboard | Tamias" }],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const loaderData = Route.useLoaderData() as Awaited<
    ReturnType<typeof loadDashboardData>
  >;

  return (
    <AppLayoutShell
      dehydratedState={loaderData.dehydratedState}
      user={loaderData.user}
    >
      <ChatProvider initialMessages={[]} key="home">
        <Widgets initialPreferences={loaderData.initialPreferences} />
        <DeferredHomeChat geo={loaderData.geo} />
      </ChatProvider>
    </AppLayoutShell>
  );
}
