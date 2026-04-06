import { createLazyFileRoute } from "@tanstack/react-router";
import { AppLayoutShell } from "@/start/components/app-layout-shell";
import { InboxBlocklistSettings } from "@/components/inbox/inbox-blocklist-settings";
import { InboxConnectedAccounts } from "@/components/inbox/inbox-connected-accounts";
import { InboxEmailSettings } from "@/components/inbox/inbox-email-settings";
import { loadInboxSettingsData } from "./settings";

export const Route = createLazyFileRoute("/inbox/settings")({
  component: InboxSettingsPage,
});

function InboxSettingsPage() {
  const loaderData = Route.useLoaderData() as Awaited<ReturnType<typeof loadInboxSettingsData>>;

  return (
    <AppLayoutShell dehydratedState={loaderData.dehydratedState} user={loaderData.user}>
      <div className="max-w-[800px]">
        <main className="mt-8">
          <div className="space-y-12">
            <InboxEmailSettings />
            <InboxBlocklistSettings />
            <InboxConnectedAccounts />
          </div>
        </main>
      </div>
    </AppLayoutShell>
  );
}
