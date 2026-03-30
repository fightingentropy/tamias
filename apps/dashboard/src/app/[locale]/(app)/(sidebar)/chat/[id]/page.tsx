import { Provider as ChatProvider } from "@ai-sdk-tools/store";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ChatInterface } from "@/components/chat/chat-interface";
import { getChatMessagesLocally } from "@/server/loaders/chat";
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
  const chat = await getChatMessagesLocally(id);

  if (!chat) {
    redirect("/dashboard");
  }

  return (
    <ChatProvider initialMessages={chat} key={id}>
      <ChatInterface geo={geo} />
    </ChatProvider>
  );
}
