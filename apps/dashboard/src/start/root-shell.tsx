import "@/styles/globals.css";
import "@/site/styles/globals.css";
import "@tamias/ui/globals.css";
import { Provider as Analytics } from "@tamias/events/client";
import { cn } from "@tamias/ui/cn";
import { getConvexUrl } from "@tamias/utils/envs";
import { HeadContent, Scripts } from "@tanstack/react-router";
import { NuqsAdapter } from "nuqs/adapters/tanstack-router";
import { DeferredToaster } from "@/components/deferred-toaster";
import { AuthProvider } from "@/framework/convex-auth-client";
import { Providers } from "@/providers";
import { Footer } from "@/site/components/footer";
import { Header as SiteHeader } from "@/site/components/header";
import { JsonLdScript } from "@/start/site-head";
import { useRouter } from "@tanstack/react-router";
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

const siteOrganizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Tamias",
  url: "https://tamias.xyz",
  logo: "https://cdn.tamias.xyz/logo.png",
  sameAs: [
    "https://x.com/tamias",
    "https://github.com/fightingentropy/tamias",
    "https://linkedin.com/company/tamias",
  ],
  description:
    "Tamias gives you one place for transactions, receipts, invoices and everything around your business finances without manual work.",
};

function requireEnv(value: string | undefined, name: string) {
  if (value === undefined) {
    throw new Error(`Missing environment variable \`${name}\``);
  }

  return value;
}

function ConvexAuthStartProvider(props: {
  bootstrap: RootBootstrapData;
  children: ReactNode;
}) {
  const router = useRouter();

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
      _timeFetched: Date.now(),
    }),
    [props.bootstrap.auth],
  );

  return (
    <AuthProvider
      client={authClient as any}
      serverState={serverState}
      onChange={async () => {
        await router.invalidate();
      }}
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

export function StartRootShell(props: {
  bootstrap: RootBootstrapData;
  children: ReactNode;
}) {
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
          <ConvexAuthStartProvider bootstrap={props.bootstrap}>
            <Providers locale="en">
              {props.children}
              <DeferredToaster />
            </Providers>
          </ConvexAuthStartProvider>
          <Analytics />
        </NuqsAdapter>
        <Scripts />
      </body>
    </html>
  );
}

export function SiteLayoutShell(props: { children: ReactNode }) {
  return (
    <div className="bg-background overflow-x-hidden whitespace-normal">
      <JsonLdScript value={siteOrganizationJsonLd} />
      <SiteHeader />
      <main className="container mx-auto overflow-hidden px-4 md:overflow-visible">
        {props.children}
      </main>
      <Footer />
    </div>
  );
}
