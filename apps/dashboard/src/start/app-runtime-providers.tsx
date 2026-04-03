"use client";

import { getConvexUrl } from "@tamias/utils/envs";
import type { ReactNode } from "react";
import { useCallback, useMemo } from "react";
import { DeferredToaster } from "@/components/deferred-toaster";
import { AuthProvider } from "@/framework/convex-auth-client";
import { AppProviders } from "@/app-providers";
import type { RootBootstrapData } from "@/start/root-bootstrap";

function requireEnv(value: string | undefined, name: string) {
  if (value === undefined) {
    throw new Error(`Missing environment variable \`${name}\``);
  }

  return value;
}

function ConvexAuthStartProvider(props: {
  children: ReactNode;
  bootstrap: RootBootstrapData;
}) {
  const call = useCallback(
    async (action: string, args: unknown) => {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ action, args }),
      });

      if (response.status >= 400) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Authentication failed");
      }

      return response.json();
    },
    [],
  );

  const authClient = useMemo(
    () => ({
      authenticatedCall: call,
      unauthenticatedCall: call,
    }),
    [call],
  );

  const serverState = useMemo(
    () => ({
      _state: props.bootstrap.auth,
      _timeFetched: props.bootstrap.fetchedAt,
    }),
    [props.bootstrap.auth, props.bootstrap.fetchedAt],
  );

  return (
    <AuthProvider
      client={authClient as any}
      serverState={serverState}
      shouldHandleCode={false}
      storage={typeof window === "undefined" ? null : window.localStorage}
      storageNamespace={requireEnv(getConvexUrl() || undefined, "CONVEX_URL")}
      replaceURL={(url: string) => {
        window.history.replaceState({}, "", url);
      }}
    >
      {props.children}
    </AuthProvider>
  );
}

export function AppRuntimeProviders(props: {
  children: ReactNode;
  bootstrap: RootBootstrapData;
}) {
  return (
    <ConvexAuthStartProvider bootstrap={props.bootstrap}>
      <AppProviders locale="en">
        {props.children}
        <DeferredToaster />
      </AppProviders>
    </ConvexAuthStartProvider>
  );
}
