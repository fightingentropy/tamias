import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Suspense } from "react";
import { AppLayoutShell } from "@/start/components/app-layout-shell";
import { ErrorBoundary } from "@/components/error-boundary";
import { ErrorFallback } from "@/components/error-fallback";
import { ScrollableContent } from "@/components/scrollable-content";
import { VaultHeader } from "@/components/vault/vault-header";
import { VaultSkeleton } from "@/components/vault/vault-skeleton";
import { VaultView } from "@/components/vault/vault-view";

const loadVaultData = createServerFn({ method: "GET" })
  .inputValidator((data: { href: string }) => data)
  .handler(async ({ data }) => {
    const { buildVaultPageData } = await import("@/start/server/route-data");
    return (await buildVaultPageData(data.href)) as any;
  });

export const Route = createFileRoute("/vault")({
  loader: ({ location }) => loadVaultData({ data: { href: location.href } }),
  head: () => ({
    meta: [{ title: "Vault | Tamias" }],
  }),
  component: VaultPage,
});

function VaultPage() {
  const loaderData = Route.useLoaderData() as Awaited<
    ReturnType<typeof loadVaultData>
  >;

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
