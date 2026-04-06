"use client";

import { Provider as ChatProvider } from "@ai-sdk-tools/store";
import type { ReactNode } from "react";
import { useDashboardChatSession } from "@/components/chat/use-dashboard-chat-session";
import { sharedChatStore } from "@/components/chat/shared-chat-store";
import { useAuthToken } from "@/framework/auth-client";

function ChatRuntimeSession() {
  useDashboardChatSession({});
  return null;
}

function AuthenticatedChatRuntimeSession() {
  const token = useAuthToken();
  if (!token) {
    return null;
  }

  return <ChatRuntimeSession />;
}

export function GlobalChatRuntime({ children }: { children: ReactNode }) {
  return (
    <ChatProvider store={sharedChatStore}>
      <AuthenticatedChatRuntimeSession />
      {children}
    </ChatProvider>
  );
}
