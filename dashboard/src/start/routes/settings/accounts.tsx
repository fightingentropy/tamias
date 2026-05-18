import { createAppFileRoute } from "@/start/route-hosts";
import { createServerFn } from "@tanstack/react-start";

export const loadSettingsAccountsData = createServerFn({ method: "GET" }).handler(async () => {
  const { buildSettingsAccountsPageData } =
    await import("@/start/server/route-data/settings-accounts");
  return await buildSettingsAccountsPageData();
});

export const Route = createAppFileRoute("/settings/accounts")({
  loader: () => loadSettingsAccountsData(),
  head: () => ({
    meta: [{ title: "Bank Connections | Tamias" }],
  }),
});
