import "@/styles/globals.css";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import { cn } from "@tamias/ui/cn";
import "@tamias/ui/globals.css";
import { Provider as Analytics } from "@tamias/events/client";
import { getAppUrl } from "@tamias/utils/envs";
import type { Metadata } from "next";
import { Hedvig_Letters_Sans, Hedvig_Letters_Serif } from "next/font/google";
import { notFound } from "next/navigation";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import type { ReactElement } from "react";
import { DeferredToaster } from "@/components/deferred-toaster";
import { getStaticParams } from "@/locales/server";
import { Providers } from "./providers";

const appUrl = getAppUrl();
const staticParams = getStaticParams();
const supportedLocales = new Set(staticParams.map((params) => params.locale));
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

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: "Tamias | Your AI-Powered Business Assistant",
  description:
    "Automate financial tasks, stay organized, and make informed decisions effortlessly.",
  twitter: {
    title: "Tamias | Your AI-Powered Business Assistant",
    description:
      "Automate financial tasks, stay organized, and make informed decisions effortlessly.",
    images: [
      {
        url: "https://cdn.tamias.xyz/opengraph-image-v1.jpg",
        width: 800,
        height: 600,
      },
      {
        url: "https://cdn.tamias.xyz/opengraph-image-v1.jpg",
        width: 1800,
        height: 1600,
      },
    ],
  },
  openGraph: {
    title: "Tamias | Your AI-Powered Business Assistant",
    description:
      "Automate financial tasks, stay organized, and make informed decisions effortlessly.",
    url: appUrl,
    siteName: "Tamias",
    images: [
      {
        url: "https://cdn.tamias.xyz/opengraph-image-v1.jpg",
        width: 800,
        height: 600,
      },
      {
        url: "https://cdn.tamias.xyz/opengraph-image-v1.jpg",
        width: 1800,
        height: 1600,
      },
    ],
    locale: "en_US",
    type: "website",
  },
};

const hedvigSans = Hedvig_Letters_Sans({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  variable: "--font-hedvig-sans",
});

const hedvigSerif = Hedvig_Letters_Serif({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  variable: "--font-hedvig-serif",
});

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: "(prefers-color-scheme: light)" },
    { media: "(prefers-color-scheme: dark)" },
  ],
};

export function generateStaticParams() {
  return staticParams;
}

export const dynamicParams = false;

export default async function Layout({
  children,
  params,
}: {
  children: ReactElement;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!supportedLocales.has(locale)) {
    notFound();
  }

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: themeBootstrapScript,
          }}
        />
      </head>
      <body
        className={cn(
          `${hedvigSans.variable} ${hedvigSerif.variable} font-sans`,
          "whitespace-pre-line overscroll-none antialiased",
        )}
      >
        <NuqsAdapter>
          <ConvexAuthNextjsServerProvider>
            <Providers locale={locale}>
              {children}
              <DeferredToaster />
            </Providers>
          </ConvexAuthNextjsServerProvider>
          <Analytics />
        </NuqsAdapter>
      </body>
    </html>
  );
}
