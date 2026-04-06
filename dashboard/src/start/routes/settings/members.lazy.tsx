import { createLazyFileRoute } from "@tanstack/react-router";
import { AppLayoutShell } from "@/start/components/app-layout-shell";
import { TeamMembers } from "@/components/team-members";
import { loadSettingsMembersData } from "./members";

export const Route = createLazyFileRoute("/settings/members")({
  component: SettingsMembersPage,
});

function SettingsMembersPage() {
  const loaderData = Route.useLoaderData() as Awaited<ReturnType<typeof loadSettingsMembersData>>;

  return (
    <AppLayoutShell dehydratedState={loaderData.dehydratedState} user={loaderData.user}>
      <TeamMembers />
    </AppLayoutShell>
  );
}
