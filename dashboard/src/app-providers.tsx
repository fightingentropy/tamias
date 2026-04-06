"use client";

import type { ReactNode } from "react";
import { BankInitialSyncRecovery } from "@/components/bank-initial-sync-recovery";
import { GlobalChatRuntime } from "@/components/chat/global-chat-runtime";
import { PlaidLinkBridgeProvider } from "@/components/plaid-link-bridge";
import { SiteProviders } from "@/site-providers";
import { TRPCReactProvider } from "@/trpc/client";

type ProviderProps = {
  locale: string;
  children: ReactNode;
};

export function AppProviders({ locale, children }: ProviderProps) {
  return (
    <TRPCReactProvider>
      <BankInitialSyncRecovery />
      <PlaidLinkBridgeProvider>
        <SiteProviders locale={locale}>
          <GlobalChatRuntime>{children}</GlobalChatRuntime>
        </SiteProviders>
      </PlaidLinkBridgeProvider>
    </TRPCReactProvider>
  );
}
