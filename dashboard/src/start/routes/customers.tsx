import { createFileRoute } from "@tanstack/react-router"
import { createAppFileRoute } from "@/start/route-hosts";
import { createServerFn } from "@tanstack/react-start";

export const loadCustomersData = createServerFn({ method: "GET" })
  .inputValidator((data: { href: string }) => data)
  .handler(async ({ data }) => {
    const { buildCustomersPageData } = await import(
      "@/start/server/route-data/customers"
    );
    return (await buildCustomersPageData(data.href));
  });

export type CustomersLoaderData = Awaited<ReturnType<typeof loadCustomersData>>;

export const Route = createAppFileRoute("/customers")({
  loader: ({ location }) => loadCustomersData({ data: { href: location.href } }),
  head: () => ({
    meta: [{ title: "Customers | Tamias" }],
  }),
});
