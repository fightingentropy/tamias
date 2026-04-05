import { createFileRoute } from "@tanstack/react-router"
import { createAppFileRoute } from "@/start/route-hosts";
import { createServerFn } from "@tanstack/react-start";

export const loadSettingsDeveloperData = createServerFn({ method: "GET" }).handler(
  async () => {
    const { buildSettingsDeveloperPageData } = await import(
      "@/start/server/route-data/settings-developer"
    );
    return (await buildSettingsDeveloperPageData());
  },
);

export const Route = createAppFileRoute("/settings/developer")({
  loader: () => loadSettingsDeveloperData(),
  head: () => ({
    meta: [{ title: "Developer | Tamias" }],
  }),
});
