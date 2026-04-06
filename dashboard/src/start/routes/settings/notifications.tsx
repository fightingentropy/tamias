import { createFileRoute } from "@tanstack/react-router";
import { createAppFileRoute } from "@/start/route-hosts";
import { createServerFn } from "@tanstack/react-start";

export const loadSettingsNotificationsData = createServerFn({ method: "GET" }).handler(async () => {
  const { buildSettingsNotificationsPageData } = await import("@/start/server/route-data/settings");
  return await buildSettingsNotificationsPageData();
});

export const Route = createAppFileRoute("/settings/notifications")({
  loader: () => loadSettingsNotificationsData(),
  head: () => ({
    meta: [{ title: "Notifications | Tamias" }],
  }),
});
