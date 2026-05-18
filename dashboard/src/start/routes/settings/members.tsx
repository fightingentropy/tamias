import { createAppFileRoute } from "@/start/route-hosts";
import { createServerFn } from "@tanstack/react-start";

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
