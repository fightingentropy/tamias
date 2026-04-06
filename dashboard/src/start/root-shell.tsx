import "@tamias/ui/globals.css";
import { cn } from "@tamias/ui/cn";
import { HeadContent, Scripts } from "@tanstack/react-router";
import { NuqsAdapter } from "nuqs/adapters/tanstack-router";
import type { ReactNode } from "react";
import { Provider as Analytics } from "@/lib/telemetry/client";
import { AppRuntimeProviders } from "@/start/app-runtime-providers";
import { DEFAULT_ROOT_BOOTSTRAP, type RootBootstrapData } from "@/start/root-bootstrap";

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

export function StartRootShell(props: { children: ReactNode; bootstrap?: RootBootstrapData }) {
  const bootstrap = props.bootstrap ?? DEFAULT_ROOT_BOOTSTRAP;
  const initialThemeFallback = getThemeFallbackColors("dark");

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Hedvig+Letters+Sans&family=Hedvig+Letters+Serif&display=swap"
          rel="stylesheet"
        />
        <meta name="theme-color" content={initialThemeFallback.background} />
        <style
          id="tamias-theme-fallback"
          suppressHydrationWarning
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
          <AppRuntimeProviders bootstrap={bootstrap}>{props.children}</AppRuntimeProviders>
          <Analytics />
        </NuqsAdapter>
        <Scripts />
      </body>
    </html>
  );
}
