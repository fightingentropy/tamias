import { createLazyFileRoute } from "@tanstack/react-router";
import { DeferredHomeChat } from "@/components/chat/deferred-home-chat";
import dynamic from "@/framework/dynamic";
import { AppLayoutShell } from "@/start/components/app-layout-shell";
import type { DashboardLoaderData } from "./dashboard";

const Widgets = dynamic(() => import("@/components/widgets").then((mod) => mod.Widgets), {
  ssr: false,
});

export const Route = createLazyFileRoute("/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const loaderData = Route.useLoaderData() as DashboardLoaderData;

  return (
    <AppLayoutShell dehydratedState={loaderData.dehydratedState} user={loaderData.user}>
      <Widgets initialPreferences={loaderData.initialPreferences} />
      <DeferredHomeChat forceOpen />
    </AppLayoutShell>
  );
}
