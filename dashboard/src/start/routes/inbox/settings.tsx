import { createFileRoute } from "@tanstack/react-router"
import { createAppFileRoute } from "@/start/route-hosts";
import { createServerFn } from "@tanstack/react-start";

export const loadInboxSettingsData = createServerFn({ method: "GET" }).handler(
  async () => {
    const { buildInboxSettingsPageData } = await import(
      "@/start/server/route-data/inbox"
    );
    return (await buildInboxSettingsPageData());
  },
);

export const Route = createAppFileRoute("/inbox/settings")({
  loader: () => loadInboxSettingsData(),
  head: () => ({
    meta: [{ title: "Inbox Settings | Tamias" }],
  }),
});
