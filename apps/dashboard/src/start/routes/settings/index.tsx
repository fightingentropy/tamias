import { createFileRoute } from "@tanstack/react-router"
import { createAppFileRoute } from "@/start/route-hosts";
import { createServerFn } from "@tanstack/react-start";

export const loadSettingsData = createServerFn({ method: "GET" }).handler(
  async () => {
    const { buildSettingsPageData } = await import("@/start/server/route-data/settings");
    return (await buildSettingsPageData()) as any;
  },
);

export const Route = createAppFileRoute("/settings/")({
  loader: () => loadSettingsData(),
  head: () => ({
    meta: [{ title: "Team Settings | Tamias" }],
  }),
});
