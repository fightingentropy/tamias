"use client";

import type { ReactNode } from "react";
import { GlobalChatRuntime } from "@/components/chat/global-chat-runtime";
import { SiteProviders } from "@/site-providers";
import { TRPCReactProvider } from "@/trpc/client";

type ProviderProps = {
  locale: string;
  children: ReactNode;
};

export function AppProviders({ locale, children }: ProviderProps) {
  return (
    <TRPCReactProvider>
      <SiteProviders locale={locale}>
        <GlobalChatRuntime>{children}</GlobalChatRuntime>
      </SiteProviders>
    </TRPCReactProvider>
  );
}
