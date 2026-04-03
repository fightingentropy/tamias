import { createFileRoute } from "@tanstack/react-router"
import { createAppFileRoute } from "@/start/route-hosts";
import { createServerFn } from "@tanstack/react-start";

export const loadTransactionCategoriesData = createServerFn({ method: "GET" }).handler(
  async () => {
    const { buildTransactionCategoriesPageData } = await import(
      "@/start/server/route-data/app"
    );
    return (await buildTransactionCategoriesPageData()) as any;
  },
);

export const Route = createAppFileRoute("/transactions/categories")({
  loader: () => loadTransactionCategoriesData(),
  head: () => ({
    meta: [{ title: "Categories | Tamias" }],
  }),
});
