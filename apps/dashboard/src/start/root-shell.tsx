import "@tamias/ui/globals.css";
import { Provider as Analytics } from "@tamias/events/client";
import { cn } from "@tamias/ui/cn";
import { getConvexUrl } from "@tamias/utils/envs";
import {
  HeadContent,
  Scripts,
  useRouterState,
} from "@tanstack/react-router";
import { NuqsAdapter } from "nuqs/adapters/tanstack-router";
import { DeferredToaster } from "@/components/deferred-toaster";
import { AuthProvider } from "@/framework/convex-auth-client";
import { AppProviders, SiteProviders } from "@/providers";
import {
  DEFAULT_ROOT_BOOTSTRAP,
  type RootBootstrapData,
} from "@/start/root-bootstrap";
import type { StartRouteStaticData } from "@/start/route-hosts";
import type { ReactNode } from "react";
import { useCallback, useMemo } from "react";

const themeBootstrapScript = `
globalThis.__name=globalThis.__name||function(target){return target;};
(() => {
  try {
    const root = document.documentElement;
    const themes = ["light", "dark"];
    const storedTheme = localStorage.getItem("theme") || "system";
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
    const resolvedTheme = storedTheme === "system" ? systemTheme : storedTheme;

    root.classList.remove(...themes);
    if (themes.includes(resolvedTheme)) {
      root.classList.add(resolvedTheme);
      root.style.colorScheme = resolvedTheme;
    }
  } catch {}
})();
`;

function isStartRouteStaticData(
  value: unknown,
): value is StartRouteStaticData {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<StartRouteStaticData>;

  return (
    (candidate.hostSurface === "app" ||
      candidate.hostSurface === "website" ||
      candidate.hostSurface === "shared") &&
    (candidate.appHostAccess === "public" ||
      candidate.appHostAccess === "protected")
  );
}

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

function SiteRuntimeProviders(props: { children: ReactNode }) {
  return (
    <SiteProviders locale="en">
      {props.children}
      <DeferredToaster />
    </SiteProviders>
  );
}

function AppRuntimeProviders(props: {
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

export function StartRootShell(props: {
  children: ReactNode;
  bootstrap?: RootBootstrapData;
}) {
  const bootstrap = props.bootstrap ?? DEFAULT_ROOT_BOOTSTRAP;
  const activeRouteStaticData = useRouterState({
    select: (state) => {
      for (let index = state.matches.length - 1; index >= 0; index -= 1) {
        const staticData = state.matches[index]?.staticData;

        if (isStartRouteStaticData(staticData)) {
          return staticData;
        }
      }

      return null;
    },
  });
  const isWebsiteRuntime =
    activeRouteStaticData?.hostSurface === "website" ||
    (bootstrap.host.isWebsiteHost &&
      activeRouteStaticData?.hostSurface !== "app");

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script
          dangerouslySetInnerHTML={{
            __html: themeBootstrapScript,
          }}
        />
      </head>
      <body className={cn("font-sans whitespace-pre-line overscroll-none antialiased")}>
        <NuqsAdapter>
          {isWebsiteRuntime ? (
            <SiteRuntimeProviders>{props.children}</SiteRuntimeProviders>
          ) : (
            <AppRuntimeProviders bootstrap={bootstrap}>
              {props.children}
            </AppRuntimeProviders>
          )}
          <Analytics />
        </NuqsAdapter>
        <Scripts />
      </body>
    </html>
  );
}
