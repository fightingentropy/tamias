import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Suspense } from "react";
import { AppLayoutShell } from "@/start/components/app-layout-shell";
import { ErrorBoundary } from "@/components/error-boundary";
import { ErrorFallback } from "@/components/error-fallback";
import { ProductsSkeleton } from "@/components/tables/products/skeleton";
import { DataTable } from "@/components/tables/products/table";

const loadInvoiceProductsData = createServerFn({ method: "GET" }).handler(
  async () => {
    const { buildInvoiceProductsPageData } = await import(
      "@/start/server/route-data"
    );
    return (await buildInvoiceProductsPageData()) as any;
  },
);

export const Route = createFileRoute("/invoices/products")({
  loader: () => loadInvoiceProductsData(),
  head: () => ({
    meta: [{ title: "Products | Tamias" }],
  }),
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
