import { createFileRoute } from "@tanstack/react-router";
import { createAppFileRoute } from "@/start/route-hosts";
import { createServerFn } from "@tanstack/react-start";

export const loadInboxData = createServerFn({ method: "GET" })
  .inputValidator((data: { href: string }) => data)
  .handler(async ({ data }) => {
    const { buildInboxPageData } = await import("@/start/server/route-data/inbox");
    return await buildInboxPageData(data.href);
  });

export type InboxLoaderData = Awaited<ReturnType<typeof loadInboxData>>;

export const Route = createAppFileRoute("/inbox")({
  loader: ({ location }) => loadInboxData({ data: { href: location.href } }),
  head: () => ({
    meta: [{ title: "Inbox | Tamias" }],
  }),
});
