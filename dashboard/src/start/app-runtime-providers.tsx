"use client";

import type { ReactNode } from "react";
import { DeferredToaster } from "@/components/deferred-toaster";
import { AuthProvider } from "@/framework/auth-client";
import { AppProviders } from "@/app-providers";
import type { RootBootstrapData } from "@/start/root-bootstrap";

export function AppRuntimeProviders(props: {
  children: ReactNode;
  bootstrap: RootBootstrapData;
}) {
  return (
    <AuthProvider bootstrap={props.bootstrap}>
      <AppProviders locale="en">
        {props.children}
        <DeferredToaster />
      </AppProviders>
    </AuthProvider>
  );
}
