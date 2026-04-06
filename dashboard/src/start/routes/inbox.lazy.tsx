import { createLazyFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { ErrorBoundary } from "@/components/error-boundary";
import { ErrorFallback } from "@/components/error-fallback";
import { Inbox } from "@/components/inbox";
import { InboxConnectedEmpty } from "@/components/inbox/inbox-empty";
import { InboxGetStarted } from "@/components/inbox/inbox-get-started";
import { InboxViewSkeleton } from "@/components/inbox/inbox-skeleton";
import { InboxView } from "@/components/inbox/inbox-view";
import { AppLayoutShell } from "@/start/components/app-layout-shell";
import type { InboxLoaderData } from "./inbox";

export const Route = createLazyFileRoute("/inbox")({
  component: InboxPage,
});

function InboxPage() {
  const loaderData = Route.useLoaderData() as InboxLoaderData;

  return (
    <AppLayoutShell dehydratedState={loaderData.dehydratedState} user={loaderData.user}>
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
