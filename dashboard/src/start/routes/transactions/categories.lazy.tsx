import { createLazyFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { AppLayoutShell } from "@/start/components/app-layout-shell";
import { CategoriesSkeleton } from "@/components/tables/categories/skeleton";
import { DataTable } from "@/components/tables/categories/table";
import { ErrorBoundary } from "@/components/error-boundary";
import { ErrorFallback } from "@/components/error-fallback";
import { loadTransactionCategoriesData } from "./categories";

export const Route = createLazyFileRoute("/transactions/categories")({
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
