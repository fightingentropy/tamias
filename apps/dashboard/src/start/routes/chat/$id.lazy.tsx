import { Provider as ChatProvider } from "@ai-sdk-tools/store";
import { createLazyFileRoute } from "@tanstack/react-router";
import { ChatInterface } from "@/components/chat/chat-interface";
import { AppLayoutShell } from "@/start/components/app-layout-shell";
import { loadChatData } from "./$id";

export const Route = createLazyFileRoute("/chat/$id")({
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
