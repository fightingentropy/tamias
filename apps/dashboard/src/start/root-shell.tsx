import "@tamias/ui/globals.css";
import { Provider as Analytics } from "@tamias/events/client";
import { cn } from "@tamias/ui/cn";
import { getConvexUrl } from "@tamias/utils/envs";
import { getStartContext } from "@tanstack/start-storage-context";
import {
  HeadContent,
  Scripts,
  useRouterState,
} from "@tanstack/react-router";
import { NuqsAdapter } from "nuqs/adapters/tanstack-router";
import { DeferredToaster } from "@/components/deferred-toaster";
import { AuthProvider } from "@/framework/convex-auth-client";
import { AppProviders, SiteProviders } from "@/providers";
import type { StartRouteStaticData } from "@/start/route-hosts";
import type { ReactNode } from "react";
import { useCallback, useMemo } from "react";

export type RootBootstrapData = {
  auth: {
    token: string | null;
    refreshToken: string | null;
  };
  host: {
    appHost: string;
    websiteHost: string;
    currentHost: string;
    isAppHost: boolean;
    isWebsiteHost: boolean;
  };
};

declare global {
  interface Window {
    __TAMIAS_START_BOOTSTRAP__?: RootBootstrapData;
  }
}

const DEFAULT_BOOTSTRAP: RootBootstrapData = {
  auth: {
    token: null,
    refreshToken: null,
  },
  host: {
    appHost: "",
    websiteHost: "",
    currentHost: "",
    isAppHost: true,
    isWebsiteHost: false,
  },
};

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

function escapeInlineScriptJson(value: string) {
  return value
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function getServerRootBootstrapData(): RootBootstrapData | null {
  if (typeof window !== "undefined") {
    return null;
  }

  const startContext = getStartContext({ throwIfNotFound: false });

  if (!startContext) {
    return null;
  }

  const auth = startContext.contextAfterGlobalMiddlewares?.auth as
    | {
        token?: string | null;
        refreshToken?: string | null;
      }
    | undefined;
  const canonicalHost = startContext.contextAfterGlobalMiddlewares?.canonicalHost as
    | RootBootstrapData["host"]
    | undefined;
  const requestUrl = new URL(startContext.request.url);
  const currentHost = startContext.request.headers.get("host") ?? requestUrl.host;

  return {
    auth: {
      token: auth?.token ?? null,
      refreshToken: auth?.refreshToken ?? null,
    },
    host: canonicalHost ?? {
      appHost: currentHost,
      websiteHost: currentHost,
      currentHost,
      isAppHost: true,
      isWebsiteHost: false,
    },
  };
}

function getClientRootBootstrapData() {
  if (typeof window === "undefined") {
    return DEFAULT_BOOTSTRAP;
  }

  return window.__TAMIAS_START_BOOTSTRAP__ ?? DEFAULT_BOOTSTRAP;
}

function getCurrentRootBootstrapData() {
  return getServerRootBootstrapData() ?? getClientRootBootstrapData();
}

function getInlineBootstrapScript() {
  const bootstrap = getServerRootBootstrapData();

  if (!bootstrap) {
    return null;
  }

  return `window.__TAMIAS_START_BOOTSTRAP__=${escapeInlineScriptJson(JSON.stringify(bootstrap))};`;
}

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
      _state: getCurrentRootBootstrapData().auth,
      _timeFetched: Date.now(),
    }),
    [],
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
}) {
  return (
    <ConvexAuthStartProvider>
      <AppProviders locale="en">
        {props.children}
        <DeferredToaster />
      </AppProviders>
    </ConvexAuthStartProvider>
  );
}

export function StartRootShell(props: {
  children: ReactNode;
}) {
  const bootstrap = getCurrentRootBootstrapData();
  const inlineBootstrapScript = getInlineBootstrapScript();
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
        {inlineBootstrapScript ? (
          <script
            dangerouslySetInnerHTML={{
              __html: inlineBootstrapScript,
            }}
          />
        ) : null}
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
            <AppRuntimeProviders>
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
