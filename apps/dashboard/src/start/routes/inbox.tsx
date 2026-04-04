import { createFileRoute } from "@tanstack/react-router"
import { createAppFileRoute } from "@/start/route-hosts";
import { createServerFn } from "@tanstack/react-start";
import { createSiteMetadata } from "@/site/page-metadata";
import { buildHeadFromMetadata } from "@/start/site-head";

const inboxSiteMetadata = createSiteMetadata({
  title: "Receipt Inbox",
  description:
    "Capture receipts and invoices automatically. Match documents to transactions, search your records, and stay organized. Built for small business owners.",
  path: "/inbox",
  keywords: [
    "receipt management",
    "receipt scanner",
    "invoice management",
    "document management",
    "expense receipts",
  ],
});

export const loadInboxData = createServerFn({ method: "GET" })
  .inputValidator((data: { href: string }) => data)
  .handler(async ({ data }) => {
    const { buildInboxPageData } = await import("@/start/server/route-data/inbox");
    return (await buildInboxPageData(data.href)) as any;
  });

export type InboxLoaderData = Awaited<ReturnType<typeof loadInboxData>>;

export const Route = createAppFileRoute("/inbox")({
  loader: ({ location }) => loadInboxData({ data: { href: location.href } }),
  head: ({ loaderData }) =>
    loaderData?.mode === "site"
      ? buildHeadFromMetadata(inboxSiteMetadata)
      : {
          meta: [{ title: "Inbox | Tamias" }],
        },
});
