import { createFileRoute } from "@tanstack/react-router"
import { createAppFileRoute } from "@/start/route-hosts";
import { createServerFn } from "@tanstack/react-start";

export const loadSettingsBillingData = createServerFn({ method: "GET" }).handler(
  async () => {
    const { buildSettingsBillingPageData } = await import(
      "@/start/server/route-data/settings-billing"
    );
    return (await buildSettingsBillingPageData());
  },
);

export const Route = createAppFileRoute("/settings/billing")({
  loader: () => loadSettingsBillingData(),
  head: () => ({
    meta: [{ title: "Billing | Tamias" }],
  }),
});
