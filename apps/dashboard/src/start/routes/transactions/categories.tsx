import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Suspense } from "react";
import { AppLayoutShell } from "@/start/components/app-layout-shell";
import { CategoriesSkeleton } from "@/components/tables/categories/skeleton";
import { DataTable } from "@/components/tables/categories/table";
import { ErrorBoundary } from "@/components/error-boundary";
import { ErrorFallback } from "@/components/error-fallback";

const loadTransactionCategoriesData = createServerFn({ method: "GET" }).handler(
  async () => {
    const { buildTransactionCategoriesPageData } = await import(
      "@/start/server/route-data"
    );
    return (await buildTransactionCategoriesPageData()) as any;
  },
);

export const Route = createFileRoute("/transactions/categories")({
  loader: () => loadTransactionCategoriesData(),
  head: () => ({
    meta: [{ title: "Categories | Tamias" }],
  }),
  component: TransactionCategoriesPage,
});

function TransactionCategoriesPage() {
  const loaderData = Route.useLoaderData() as Awaited<
    ReturnType<typeof loadTransactionCategoriesData>
  >;

  return (
    <AppLayoutShell
      dehydratedState={loaderData.dehydratedState}
      user={loaderData.user}
    >
      <div className="max-w-screen-lg">
        <ErrorBoundary errorComponent={ErrorFallback}>
          <Suspense fallback={<CategoriesSkeleton />}>
            <DataTable />
          </Suspense>
        </ErrorBoundary>
      </div>
    </AppLayoutShell>
  );
}
