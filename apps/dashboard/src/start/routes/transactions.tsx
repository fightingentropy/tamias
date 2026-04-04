import { createFileRoute } from "@tanstack/react-router"
import { createAppFileRoute } from "@/start/route-hosts";
import { createServerFn } from "@tanstack/react-start";
import { createSiteMetadata } from "@/site/page-metadata";
import { buildHeadFromMetadata } from "@/start/site-head";

const transactionsSiteMetadata = createSiteMetadata({
  title: "Transactions",
  description:
    "Track all your business expenses in one place. Automatically sync and categorize transactions from your bank accounts. Built for small business owners.",
  path: "/transactions",
  keywords: [
    "expense tracking",
    "business expenses",
    "transaction management",
    "expense categorization",
    "small business accounting",
  ],
});

export const loadTransactionsData = createServerFn({ method: "GET" })
  .inputValidator((data: { href: string }) => data)
  .handler(async ({ data }) => {
    const { buildTransactionsPageData } = await import("@/start/server/route-data/app");
    return (await buildTransactionsPageData(data.href)) as any;
  });

export type TransactionsLoaderData = Awaited<
  ReturnType<typeof loadTransactionsData>
>;

export const Route = createAppFileRoute("/transactions")({
  loader: ({ location }) =>
    loadTransactionsData({ data: { href: location.href } }),
  head: ({ loaderData }) =>
    loaderData?.mode === "site"
      ? buildHeadFromMetadata(transactionsSiteMetadata)
      : {
          meta: [{ title: "Transactions | Tamias" }],
        },
});
