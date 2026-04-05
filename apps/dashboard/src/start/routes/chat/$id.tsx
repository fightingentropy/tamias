import { createFileRoute } from "@tanstack/react-router"
import { createAppFileRoute } from "@/start/route-hosts";
import { createServerFn } from "@tanstack/react-start";

export const loadChatData = createServerFn({ method: "GET" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const { buildChatPageData } = await import("@/start/server/route-data/misc");
    return (await buildChatPageData(data.id)) as any;
  });

export const Route = createAppFileRoute("/chat/$id")({
  loader: ({ params }) => loadChatData({ data: { id: params.id } }),
  head: () => ({
    meta: [{ title: "Chat | Tamias" }],
  }),
});
