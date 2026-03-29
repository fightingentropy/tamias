import type { Metadata } from "next";
import { InboxBlocklistSettings } from "@/components/inbox/inbox-blocklist-settings";
import { InboxConnectedAccounts } from "@/components/inbox/inbox-connected-accounts";
import { InboxEmailSettings } from "@/components/inbox/inbox-email-settings";
import {
  getInboxAccountsLocally,
  getInboxBlocklistLocally,
} from "@/server/loaders/inbox";
import { getQueryClient, HydrateClient, trpc } from "@/trpc/server";

export const metadata: Metadata = {
  title: "Inbox Settings | Tamias",
};

export default async function Page() {
  const queryClient = getQueryClient();
  const inboxAccountsQuery = trpc.inboxAccounts.get.queryOptions();
  const inboxBlocklistQuery = trpc.inbox.blocklist.get.queryOptions();
  const [inboxAccounts, blocklist] = await Promise.all([
    getInboxAccountsLocally(),
    getInboxBlocklistLocally(),
  ]);

  queryClient.setQueryData(inboxAccountsQuery.queryKey, inboxAccounts);
  queryClient.setQueryData(inboxBlocklistQuery.queryKey, blocklist);

  return (
    <HydrateClient>
      <div className="max-w-[800px]">
        <main className="mt-8">
          <div className="space-y-12">
            <InboxEmailSettings />
            <InboxBlocklistSettings />
            <InboxConnectedAccounts />
          </div>
        </main>
      </div>
    </HydrateClient>
  );
}
