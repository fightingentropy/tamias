import { createLazyFileRoute } from "@tanstack/react-router";
import { AppLayoutShell } from "@/start/components/app-layout-shell";
import { ConnectedAccounts } from "@/components/connected-accounts";
import { loadSettingsAccountsData } from "./accounts";

export const Route = createLazyFileRoute("/settings/accounts")({
  component: SettingsAccountsPage,
});

function SettingsAccountsPage() {
  const loaderData = Route.useLoaderData() as Awaited<ReturnType<typeof loadSettingsAccountsData>>;

  return (
    <AppLayoutShell dehydratedState={loaderData.dehydratedState} user={loaderData.user}>
      <div className="space-y-12">
        <ConnectedAccounts />
      </div>
    </AppLayoutShell>
  );
}
