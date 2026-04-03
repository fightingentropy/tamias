import { createLazyFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { AppLayoutShell } from "@/start/components/app-layout-shell";
import { ErrorBoundary } from "@/components/error-boundary";
import { ErrorFallback } from "@/components/error-fallback";
import { ProductsSkeleton } from "@/components/tables/products/skeleton";
import { DataTable } from "@/components/tables/products/table";
import { loadInvoiceProductsData } from "./products";

export const Route = createLazyFileRoute("/invoices/products")({
  component: InvoiceProductsPage,
});

function InvoiceProductsPage() {
  const loaderData = Route.useLoaderData() as Awaited<
    ReturnType<typeof loadInvoiceProductsData>
  >;

  return (
    <AppLayoutShell
      dehydratedState={loaderData.dehydratedState}
      user={loaderData.user}
    >
      <div className="max-w-screen-lg">
        <ErrorBoundary errorComponent={ErrorFallback}>
          <Suspense fallback={<ProductsSkeleton />}>
            <DataTable />
          </Suspense>
        </ErrorBoundary>
      </div>
    </AppLayoutShell>
  );
}
