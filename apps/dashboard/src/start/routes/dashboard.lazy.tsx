import { Provider as ChatProvider } from "@ai-sdk-tools/store";
import { createLazyFileRoute } from "@tanstack/react-router";
import { DeferredHomeChat } from "@/components/chat/deferred-home-chat";
import { Widgets } from "@/components/widgets";
import { AppLayoutShell } from "@/start/components/app-layout-shell";
import type { DashboardLoaderData } from "./dashboard";

export const Route = createLazyFileRoute("/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const loaderData = Route.useLoaderData() as DashboardLoaderData;

  return (
    <AppLayoutShell
      dehydratedState={loaderData.dehydratedState}
      user={loaderData.user}
    >
      <ChatProvider initialMessages={[]} key="home">
        <Widgets initialPreferences={loaderData.initialPreferences} />
        <DeferredHomeChat geo={loaderData.geo ?? undefined} />
      </ChatProvider>
    </AppLayoutShell>
  );
}
