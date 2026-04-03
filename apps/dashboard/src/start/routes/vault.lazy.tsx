import { createLazyFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { ErrorBoundary } from "@/components/error-boundary";
import { ErrorFallback } from "@/components/error-fallback";
import { ScrollableContent } from "@/components/scrollable-content";
import { VaultHeader } from "@/components/vault/vault-header";
import { VaultSkeleton } from "@/components/vault/vault-skeleton";
import { VaultView } from "@/components/vault/vault-view";
import { AppLayoutShell } from "@/start/components/app-layout-shell";
import type { VaultLoaderData } from "./vault";

export const Route = createLazyFileRoute("/vault")({
  component: VaultPage,
});

function VaultPage() {
  const loaderData = Route.useLoaderData() as VaultLoaderData;

  return (
    <AppLayoutShell
      dehydratedState={loaderData.dehydratedState}
      user={loaderData.user}
    >
      <ScrollableContent>
        <VaultHeader />

        <ErrorBoundary errorComponent={ErrorFallback}>
          <Suspense fallback={<VaultSkeleton />}>
            <VaultView initialSettings={loaderData.initialSettings} />
          </Suspense>
        </ErrorBoundary>
      </ScrollableContent>
    </AppLayoutShell>
  );
}
