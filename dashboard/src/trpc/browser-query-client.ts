"use client";

import type { QueryClient } from "@tanstack/react-query";
import { isServer } from "@tanstack/react-query";
import { makeQueryClient } from "./query-client";

let browserQueryClient: QueryClient | undefined;

export function getBrowserAwareQueryClient() {
  if (isServer) {
    return makeQueryClient();
  }

  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}

export function clearBrowserQueryCache() {
  if (isServer) {
    return;
  }

  browserQueryClient?.clear();
}
