import { Provider as ChatProvider } from "@ai-sdk-tools/store";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ChatInterface } from "@/components/chat/chat-interface";
import { Widgets } from "@/components/widgets";
import { getChatMessagesLocally } from "@/server/loaders/chat";
import {
  getCurrentWidgetPreferencesLocally,
  getSuggestedActionsLocally,
} from "@/server/loaders/widgets";
import { getQueryClient, HydrateClient, trpc } from "@/trpc/server";
import { geolocation } from "@/utils/geo";

export const metadata: Metadata = {
  title: "Chat | Tamias",
};

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ChatPage(props: Props) {
  const { id } = await props.params;

  const headersList = await headers();
  const geo = geolocation(headersList);

  const queryClient = getQueryClient();

  const chatQuery = trpc.chats.get.queryOptions({ chatId: id });
  const suggestedActionsQuery = trpc.suggestedActions.list.queryOptions({
    limit: 6,
  });
  const [widgetPreferences, suggestedActions, chat] = await Promise.all([
    getCurrentWidgetPreferencesLocally(),
    getSuggestedActionsLocally(6),
    getChatMessagesLocally(id),
  ]);

  queryClient.setQueryData(
    trpc.widgets.getWidgetPreferences.queryKey(),
    widgetPreferences,
  );
  queryClient.setQueryData(chatQuery.queryKey, chat);
  queryClient.setQueryData(suggestedActionsQuery.queryKey, suggestedActions);

  if (!chat) {
    redirect("/dashboard");
  }

  return (
    <HydrateClient>
      <ChatProvider initialMessages={chat} key={id}>
        <Widgets initialPreferences={widgetPreferences} />

        <ChatInterface geo={geo} />
      </ChatProvider>
    </HydrateClient>
  );
}
