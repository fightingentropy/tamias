import { createFileRoute } from "@tanstack/react-router"
import { createAppFileRoute } from "@/start/route-hosts";
import { createServerFn } from "@tanstack/react-start";
import { AppLayoutShell } from "@/start/components/app-layout-shell";
import { ConnectedAccounts } from "@/components/connected-accounts";

export const loadSettingsAccountsData = createServerFn({ method: "GET" }).handler(
  async () => {
    const { buildSettingsAccountsPageData } = await import(
      "@/start/server/route-data/settings-accounts"
    );
    return (await buildSettingsAccountsPageData()) as any;
  },
);

export const Route = createAppFileRoute("/settings/accounts")({
  loader: () => loadSettingsAccountsData(),
  head: () => ({
    meta: [{ title: "Bank Connections | Tamias" }],
  }),
});
