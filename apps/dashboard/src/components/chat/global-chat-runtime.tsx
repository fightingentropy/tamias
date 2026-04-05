"use client";

import { Provider as ChatProvider } from "@ai-sdk-tools/store";
import type { ReactNode } from "react";
import { useDashboardChatSession } from "@/components/chat/use-dashboard-chat-session";
import { sharedChatStore } from "@/components/chat/shared-chat-store";

function ChatRuntimeSession() {
  useDashboardChatSession({});
  return null;
}

export function GlobalChatRuntime({ children }: { children: ReactNode }) {
  return (
    <ChatProvider store={sharedChatStore}>
      <ChatRuntimeSession />
      {children}
    </ChatProvider>
  );
}
