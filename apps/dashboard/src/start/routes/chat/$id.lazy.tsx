import { createLazyFileRoute } from "@tanstack/react-router";
import { ChatStoreRouteSync } from "@/components/chat/chat-store-route-sync";
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
      <ChatStoreRouteSync
        chatId={Route.useParams().id}
        initialMessages={loaderData.chat}
      />
      <ChatInterface />
    </AppLayoutShell>
  );
}
