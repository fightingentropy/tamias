import { createFileRoute } from "@tanstack/react-router"
import { createAppFileRoute } from "@/start/route-hosts";
import { createServerFn } from "@tanstack/react-start";

export const loadTransactionCategoriesData = createServerFn({ method: "GET" }).handler(
  async () => {
    const { buildTransactionCategoriesPageData } = await import(
      "@/start/server/route-data/transactions"
    );
    return (await buildTransactionCategoriesPageData());
  },
);

export const Route = createAppFileRoute("/transactions/categories")({
  loader: () => loadTransactionCategoriesData(),
  head: () => ({
    meta: [{ title: "Categories | Tamias" }],
  }),
});
