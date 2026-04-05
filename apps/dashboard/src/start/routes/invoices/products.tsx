import { createFileRoute } from "@tanstack/react-router"
import { createAppFileRoute } from "@/start/route-hosts";
import { createServerFn } from "@tanstack/react-start";

export const loadInvoiceProductsData = createServerFn({ method: "GET" }).handler(
  async () => {
    const { buildInvoiceProductsPageData } = await import(
      "@/start/server/route-data/invoices"
    );
    return (await buildInvoiceProductsPageData()) as any;
  },
);

export const Route = createAppFileRoute("/invoices/products")({
  loader: () => loadInvoiceProductsData(),
  head: () => ({
    meta: [{ title: "Products | Tamias" }],
  }),
});
