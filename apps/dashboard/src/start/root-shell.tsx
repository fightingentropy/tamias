import "@tamias/ui/globals.css";
import { Provider as Analytics } from "@tamias/events/client";
import { cn } from "@tamias/ui/cn";
import {
  HeadContent,
  Scripts,
  useRouterState,
} from "@tanstack/react-router";
import { NuqsAdapter } from "nuqs/adapters/tanstack-router";
import dynamic from "@/framework/dynamic";
import {
  DEFAULT_ROOT_BOOTSTRAP,
  type RootBootstrapData,
} from "@/start/root-bootstrap";
import type { StartRouteStaticData } from "@/start/route-hosts";
import type { ReactNode } from "react";

const SiteRuntimeProviders = dynamic(
  () =>
    import("@/start/site-runtime-providers").then(
      (mod) => mod.SiteRuntimeProviders,
    ),
);
const AppRuntimeProviders = dynamic(
  () =>
    import("@/start/app-runtime-providers").then(
      (mod) => mod.AppRuntimeProviders,
    ),
);

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
