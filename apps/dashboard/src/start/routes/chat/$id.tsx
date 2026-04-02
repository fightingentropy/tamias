import { Provider as ChatProvider } from "@ai-sdk-tools/store";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { AppLayoutShell } from "@/start/components/app-layout-shell";
import { ChatInterface } from "@/components/chat/chat-interface";

const loadChatData = createServerFn({ method: "GET" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const { buildChatPageData } = await import("@/start/server/route-data");
    return (await buildChatPageData(data.id)) as any;
  });

export const Route = createFileRoute("/chat/$id")({
  loader: ({ params }) => loadChatData({ data: { id: params.id } }),
  head: () => ({
    meta: [{ title: "Chat | Tamias" }],
  }),
  component: ChatPage,
});

function ChatPage() {
  const loaderData = Route.useLoaderData() as Awaited<
    ReturnType<typeof loadChatData>
  >;

  return (
    <AppLayoutShell
      dehydratedState={loaderData.dehydratedState}
      user={loaderData.user}
    >
      <ChatProvider initialMessages={loaderData.chat} key={Route.useParams().id}>
        <ChatInterface geo={loaderData.geo} />
      </ChatProvider>
    </AppLayoutShell>
  );
}
