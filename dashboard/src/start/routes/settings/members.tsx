import { createFileRoute } from "@tanstack/react-router";
import { createAppFileRoute } from "@/start/route-hosts";
import { createServerFn } from "@tanstack/react-start";
import { AppLayoutShell } from "@/start/components/app-layout-shell";
import { TeamMembers } from "@/components/team-members";

export const loadSettingsMembersData = createServerFn({ method: "GET" }).handler(async () => {
  const { buildSettingsMembersPageData } =
    await import("@/start/server/route-data/settings-members");
  return await buildSettingsMembersPageData();
});

export const Route = createAppFileRoute("/settings/members")({
  loader: () => loadSettingsMembersData(),
  head: () => ({
    meta: [{ title: "Members | Tamias" }],
  }),
});
