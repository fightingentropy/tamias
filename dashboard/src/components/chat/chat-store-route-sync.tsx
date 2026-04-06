"use client";

import { useChatActions, useChatId, useChatMessages } from "@ai-sdk-tools/store";
import type { UIChatMessage } from "@tamias/contracts/chat";
import { useEffect } from "react";

type ChatStoreRouteSyncProps = {
  chatId: string;
  initialMessages: UIChatMessage[];
};

export function ChatStoreRouteSync({
  chatId,
  initialMessages,
}: ChatStoreRouteSyncProps) {
  const currentChatId = useChatId();
  const currentMessages = useChatMessages();
  const { setId, setNewChat } = useChatActions();

  useEffect(() => {
    if (initialMessages.length > 0) {
      const shouldHydrateFromRoute =
        currentChatId !== chatId || currentMessages.length === 0;

      if (shouldHydrateFromRoute) {
        setNewChat(chatId, initialMessages);
      }

      return;
    }

    if (currentChatId !== chatId) {
      setId(chatId);
    }
  }, [
    chatId,
    currentChatId,
    currentMessages.length,
    initialMessages,
    setId,
    setNewChat,
  ]);

  return null;
}
