import { createFileRoute } from "@tanstack/react-router"
import { createAppFileRoute } from "@/start/route-hosts";
import { createServerFn } from "@tanstack/react-start";
import { createSiteMetadata } from "@/site/page-metadata";
import { buildHeadFromMetadata } from "@/start/site-head";

const customersSiteMetadata = createSiteMetadata({
  title: "Customer Management",
  description:
    "Know your customers better. Track customer performance, payment history, and outstanding invoices all in one place.",
  path: "/customers",
});

export const loadCustomersData = createServerFn({ method: "GET" })
  .inputValidator((data: { href: string }) => data)
  .handler(async ({ data }) => {
    const { buildCustomersPageData } = await import(
      "@/start/server/route-data/customers"
    );
    return (await buildCustomersPageData(data.href)) as any;
  });

export type CustomersLoaderData = Awaited<ReturnType<typeof loadCustomersData>>;

export const Route = createAppFileRoute("/customers")({
  loader: ({ location }) => loadCustomersData({ data: { href: location.href } }),
  head: ({ loaderData }) =>
    loaderData?.mode === "site"
      ? buildHeadFromMetadata(customersSiteMetadata)
      : {
          meta: [{ title: "Customers | Tamias" }],
        },
});
