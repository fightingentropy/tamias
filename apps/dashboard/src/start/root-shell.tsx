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

function getThemeFallbackColors(theme: "light" | "dark") {
  if (theme === "dark") {
    return {
      background: "#0d0d0d",
      foreground: "#fafafa",
      colorScheme: "dark",
    } as const;
  }

  return {
    background: "#ffffff",
    foreground: "#121212",
    colorScheme: "light",
  } as const;
}

const themeBootstrapScript = `
globalThis.__name=globalThis.__name||function(target){return target;};
(() => {
  try {
    const root = document.documentElement;
    const fallbackStyle = document.getElementById("tamias-theme-fallback");
    const themes = ["light", "dark"];
    const storedTheme = localStorage.getItem("theme") || "system";
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
    const resolvedTheme = storedTheme === "system" ? systemTheme : storedTheme;
    const background = resolvedTheme === "dark" ? "#0d0d0d" : "#ffffff";
    const foreground = resolvedTheme === "dark" ? "#fafafa" : "#121212";

    root.classList.remove(...themes);
    if (themes.includes(resolvedTheme)) {
      root.classList.add(resolvedTheme);
      root.style.colorScheme = resolvedTheme;
      root.style.backgroundColor = background;
      if (fallbackStyle) {
        fallbackStyle.textContent = "html{background:" + background + ";color-scheme:" + resolvedTheme + "}body{background:" + background + ";color:" + foreground + "}";
      }
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
  const initialThemeFallback = getThemeFallbackColors(
    isWebsiteRuntime ? "light" : "dark",
  );

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        <meta
          name="theme-color"
          content={initialThemeFallback.background}
        />
        <style
          id="tamias-theme-fallback"
          dangerouslySetInnerHTML={{
            __html: `html{background:${initialThemeFallback.background};color-scheme:${initialThemeFallback.colorScheme}}body{background:${initialThemeFallback.background};color:${initialThemeFallback.foreground}}`,
          }}
        />
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
