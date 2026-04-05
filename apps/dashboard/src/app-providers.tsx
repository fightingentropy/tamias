"use client";

import type { ReactNode } from "react";
import { SiteProviders } from "@/site-providers";
import { TRPCReactProvider } from "@/trpc/client";

type ProviderProps = {
  locale: string;
  children: ReactNode;
};

export function AppProviders({ locale, children }: ProviderProps) {
  return (
    <TRPCReactProvider>
      <SiteProviders locale={locale}>{children}</SiteProviders>
    </TRPCReactProvider>
  );
}
