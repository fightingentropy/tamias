import { createFileRoute } from "@tanstack/react-router"
import { createAppFileRoute } from "@/start/route-hosts";
import { createServerFn } from "@tanstack/react-start";

export const loadInvoicesData = createServerFn({ method: "GET" })
  .inputValidator((data: { href: string }) => data)
  .handler(async ({ data }) => {
    const { buildInvoicesPageData } = await import(
      "@/start/server/route-data/invoices"
    );
    return (await buildInvoicesPageData(data.href));
  });

export type InvoicesLoaderData = Awaited<ReturnType<typeof loadInvoicesData>>;

export const Route = createAppFileRoute("/invoices")({
  loader: ({ location }) => loadInvoicesData({ data: { href: location.href } }),
  head: () => ({
    meta: [{ title: "Invoices | Tamias" }],
  }),
});
