import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { AppLayoutShell } from "@/start/components/app-layout-shell";
import { TeamMembers } from "@/components/team-members";

const loadSettingsMembersData = createServerFn({ method: "GET" }).handler(
  async () => {
    const { buildSettingsMembersPageData } = await import(
      "@/start/server/route-data"
    );
    return (await buildSettingsMembersPageData()) as any;
  },
);

export const Route = createFileRoute("/settings/members")({
  loader: () => loadSettingsMembersData(),
  head: () => ({
    meta: [{ title: "Members | Tamias" }],
  }),
  component: SettingsMembersPage,
});

function SettingsMembersPage() {
  const loaderData = Route.useLoaderData() as Awaited<
    ReturnType<typeof loadSettingsMembersData>
  >;

  return (
    <AppLayoutShell
      dehydratedState={loaderData.dehydratedState}
      user={loaderData.user}
    >
      <TeamMembers />
    </AppLayoutShell>
  );
}
