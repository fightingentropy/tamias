import type { Metadata } from "next";
import { ErrorBoundary } from "next/dist/client/components/error-boundary";
import { Suspense } from "react";
import { ErrorFallback } from "@/components/error-fallback";
import { ProductsSkeleton } from "@/components/tables/products/skeleton";
import { DataTable } from "@/components/tables/products/table";
import { getInvoiceProductsLocally } from "@/server/loaders/invoice-products";
import { getQueryClient, trpc } from "@/trpc/server";

export const metadata: Metadata = {
  title: "Products | Tamias",
};

export default async function Page() {
  const queryClient = getQueryClient();
  const productsQuery = trpc.invoiceProducts.get.queryOptions({
    sortBy: "recent",
    limit: 100,
    includeInactive: true,
  });
  const productsResult = await getInvoiceProductsLocally({
    sortBy: "recent",
    limit: 100,
    includeInactive: true,
  }).catch(() => null);

  if (productsResult) {
    queryClient.setQueryData(productsQuery.queryKey, productsResult);
  }

  return (
    <div className="max-w-screen-lg">
      <ErrorBoundary errorComponent={ErrorFallback}>
        <Suspense fallback={<ProductsSkeleton />}>
          <DataTable />
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}
