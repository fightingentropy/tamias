"use client";

import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";
import { ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";
import { useMemo } from "react";

type ConvexClientProviderProps = {
  children: ReactNode;
};

export function ConvexClientProvider({
  children,
}: ConvexClientProviderProps) {
  const client = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;

    if (!url) {
      throw new Error("Missing NEXT_PUBLIC_CONVEX_URL");
    }

    return new ConvexReactClient(url);
  }, []);

  return <ConvexAuthNextjsProvider client={client}>{children}</ConvexAuthNextjsProvider>;
}
