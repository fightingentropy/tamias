import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { createAppFileRoute } from "@/start/route-hosts";
import { asStartServerFnResult } from "@/start/server/as-start-server-fn-result";

export const loadChatData = createServerFn({ method: "GET" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const { buildChatPageData } = await import("@/start/server/route-data/misc");
    return asStartServerFnResult(await buildChatPageData(data.id));
  });

export const Route = createAppFileRoute("/chat/$id")({
  loader: ({ params }) => loadChatData({ data: { id: params.id } }),
  head: () => ({
    meta: [{ title: "Chat | Tamias" }],
  }),
});
