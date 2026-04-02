import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { AppLayoutShell } from "@/start/components/app-layout-shell";
import { ConnectedAccounts } from "@/components/connected-accounts";

const loadSettingsAccountsData = createServerFn({ method: "GET" }).handler(
  async () => {
    const { buildSettingsAccountsPageData } = await import(
      "@/start/server/route-data"
    );
    return (await buildSettingsAccountsPageData()) as any;
  },
);

export const Route = createFileRoute("/settings/accounts")({
  loader: () => loadSettingsAccountsData(),
  head: () => ({
    meta: [{ title: "Bank Connections | Tamias" }],
  }),
  component: SettingsAccountsPage,
});

function SettingsAccountsPage() {
  const loaderData = Route.useLoaderData() as Awaited<
    ReturnType<typeof loadSettingsAccountsData>
  >;

  return (
    <AppLayoutShell
      dehydratedState={loaderData.dehydratedState}
      user={loaderData.user}
    >
      <div className="space-y-12">
        <ConnectedAccounts />
      </div>
    </AppLayoutShell>
  );
}
