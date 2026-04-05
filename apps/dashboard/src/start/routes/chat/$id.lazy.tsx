import { createLazyFileRoute } from "@tanstack/react-router";
import { ChatInterface } from "@/components/chat/chat-interface";
import { ChatStoreRouteSync } from "@/components/chat/chat-store-route-sync";
import { AppLayoutShell } from "@/start/components/app-layout-shell";
import type { ChatPageLoaderData } from "@/start/server/route-data/misc";

export const Route = createLazyFileRoute("/chat/$id")({
  component: ChatPage,
});

function ChatPage() {
  const loaderData = Route.useLoaderData() as ChatPageLoaderData;

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
