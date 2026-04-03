import { createFileRoute } from "@tanstack/react-router"
import { createAppFileRoute } from "@/start/route-hosts";
import { createServerFn } from "@tanstack/react-start";

export const loadComplianceSettingsData = createServerFn({ method: "GET" }).handler(
  async () => {
    const { buildComplianceSettingsPageData } = await import(
      "@/start/server/route-data/compliance"
    );
    return (await buildComplianceSettingsPageData()) as any;
  },
);

export const Route = createAppFileRoute("/compliance/settings")({
  loader: () => loadComplianceSettingsData(),
  head: () => ({
    meta: [{ title: "Compliance Settings | Tamias" }],
  }),
});
