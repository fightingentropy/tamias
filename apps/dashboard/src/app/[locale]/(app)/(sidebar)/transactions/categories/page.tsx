import type { Metadata } from "next";
import { ErrorBoundary } from "next/dist/client/components/error-boundary";
import { Suspense } from "react";
import { ErrorFallback } from "@/components/error-fallback";
import { CategoriesSkeleton } from "@/components/tables/categories/skeleton";
import { DataTable } from "@/components/tables/categories/table";
import { getTransactionCategoriesLocally } from "@/server/loaders/transactions";
import { getQueryClient, HydrateClient, trpc } from "@/trpc/server";

export const metadata: Metadata = {
  title: "Categories | Tamias",
};

export default async function Categories() {
  const queryClient = getQueryClient();
  const categoriesQuery = trpc.transactionCategories.get.queryOptions();
  const categoriesResult = await getTransactionCategoriesLocally().catch(
    () => null,
  );

  if (categoriesResult) {
    queryClient.setQueryData(categoriesQuery.queryKey, categoriesResult);
  }

  return (
    <div className="max-w-screen-lg">
      <HydrateClient>
        <ErrorBoundary errorComponent={ErrorFallback}>
          <Suspense fallback={<CategoriesSkeleton />}>
            <DataTable />
          </Suspense>
        </ErrorBoundary>
      </HydrateClient>
    </div>
  );
}
