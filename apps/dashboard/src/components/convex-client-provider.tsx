"use client";

import { getConvexUrl } from "@tamias/utils/envs";
import { ConvexProviderWithAuth, ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { useAuth } from "@/framework/convex-auth-client";

type ConvexClientProviderProps = {
  children: ReactNode;
};

export function ConvexClientProvider({
  children,
}: ConvexClientProviderProps) {
  const client = useMemo(() => {
    const url = getConvexUrl();

    if (!url) {
      throw new Error("Missing CONVEX_URL");
    }

    return new ConvexReactClient(url);
  }, []);

  return (
    <ConvexProviderWithAuth client={client} useAuth={useAuth}>
      {children}
    </ConvexProviderWithAuth>
  );
}
