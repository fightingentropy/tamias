"use client";

import type { ReactNode } from "react";
import { ConvexClientProvider } from "@/components/convex-client-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { I18nProviderClient } from "@/locales/client";
import { TRPCReactProvider } from "@/trpc/client";

type ProviderProps = {
  locale: string;
  children: ReactNode;
};

export function SiteProviders({ locale, children }: ProviderProps) {
  return (
    <I18nProviderClient locale={locale}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        {children}
      </ThemeProvider>
    </I18nProviderClient>
  );
}

export function AppProviders({ locale, children }: ProviderProps) {
  return (
    <ConvexClientProvider>
      <TRPCReactProvider>
        <SiteProviders locale={locale}>{children}</SiteProviders>
      </TRPCReactProvider>
    </ConvexClientProvider>
  );
}
