import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Suspense } from "react";
import { AppLayoutShell } from "@/start/components/app-layout-shell";
import { buildHeadFromMetadata } from "@/start/site-head";
import { SiteLayoutShell } from "@/start/root-shell";
import { ErrorBoundary } from "@/components/error-boundary";
import { ErrorFallback } from "@/components/error-fallback";
import { Inbox } from "@/components/inbox";
import { InboxConnectedEmpty } from "@/components/inbox/inbox-empty";
import { InboxGetStarted } from "@/components/inbox/inbox-get-started";
import { InboxViewSkeleton } from "@/components/inbox/inbox-skeleton";
import { InboxView } from "@/components/inbox/inbox-view";
import { Inbox as SiteInbox } from "@/site/components/inbox";
import { inboxSiteMetadata } from "@/site/pages/static-pages";

const loadInboxData = createServerFn({ method: "GET" })
  .inputValidator((data: { href: string }) => data)
  .handler(async ({ data }) => {
    const { buildInboxPageData } = await import("@/start/server/route-data");
    return (await buildInboxPageData(data.href)) as any;
  });

export const Route = createFileRoute("/inbox")({
  loader: ({ location }) => loadInboxData({ data: { href: location.href } }),
  head: ({ loaderData }) =>
    loaderData?.mode === "site"
      ? buildHeadFromMetadata(inboxSiteMetadata)
      : {
          meta: [{ title: "Inbox | Tamias" }],
        },
  component: InboxPage,
});

function InboxPage() {
  const loaderData = Route.useLoaderData() as Awaited<
    ReturnType<typeof loadInboxData>
  >;

  if (loaderData.mode === "site") {
    return (
      <SiteLayoutShell>
        <SiteInbox />
      </SiteLayoutShell>
    );
  }

  return (
    <AppLayoutShell
      dehydratedState={loaderData.dehydratedState}
      user={loaderData.user}
    >
      {loaderData.view === "get-started" ? (
        <InboxGetStarted />
      ) : loaderData.view === "connected-empty" ? (
        <Inbox>
          <InboxConnectedEmpty />
        </Inbox>
      ) : (
        <Inbox>
          <ErrorBoundary errorComponent={ErrorFallback}>
            <Suspense fallback={<InboxViewSkeleton />}>
              <InboxView />
            </Suspense>
          </ErrorBoundary>
        </Inbox>
      )}
    </AppLayoutShell>
  );
}
