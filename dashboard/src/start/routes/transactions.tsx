import { createFileRoute } from "@tanstack/react-router";
import { createAppFileRoute } from "@/start/route-hosts";
import { createServerFn } from "@tanstack/react-start";

export const loadTransactionsData = createServerFn({ method: "GET" })
  .inputValidator((data: { href: string }) => data)
  .handler(async ({ data }) => {
    const { buildTransactionsPageData } = await import("@/start/server/route-data/transactions");
    return await buildTransactionsPageData(data.href);
  });

export type TransactionsLoaderData = Awaited<ReturnType<typeof loadTransactionsData>>;

export const Route = createAppFileRoute("/transactions")({
  loader: ({ location }) => loadTransactionsData({ data: { href: location.href } }),
  head: () => ({
    meta: [{ title: "Transactions | Tamias" }],
  }),
});
