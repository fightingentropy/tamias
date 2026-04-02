"use client";

import {
  notFound as tanstackNotFound,
  redirect as tanstackRedirect,
  useRouter as useTanStackRouter,
} from "@tanstack/react-router";
import { useMemo, useSyncExternalStore } from "react";

const NAVIGATION_EVENT = "tamias:navigation";
let historyPatched = false;
const serverLocationSnapshot = {
  pathname: "/",
  search: "",
};
let browserLocationSnapshot = serverLocationSnapshot;

function isExternalHref(href: string) {
  if (href.startsWith("//")) {
    return true;
  }

  try {
    return Boolean(new URL(href));
  } catch {
    return false;
  }
}

function ensureHistoryPatched() {
  if (historyPatched || typeof window === "undefined") {
    return;
  }

  historyPatched = true;

  for (const method of ["pushState", "replaceState"] as const) {
    const original = window.history[method];

    window.history[method] = function patchedHistoryState(...args) {
      const result = original.apply(this, args);
      window.dispatchEvent(new Event(NAVIGATION_EVENT));
      return result;
    };
  }
}

function subscribe(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  ensureHistoryPatched();

  window.addEventListener("popstate", onStoreChange);
  window.addEventListener("hashchange", onStoreChange);
  window.addEventListener(NAVIGATION_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("popstate", onStoreChange);
    window.removeEventListener("hashchange", onStoreChange);
    window.removeEventListener(NAVIGATION_EVENT, onStoreChange);
  };
}

function getLocationSnapshot() {
  if (typeof window === "undefined") {
    return serverLocationSnapshot;
  }

  const pathname = window.location.pathname;
  const search = window.location.search;

  if (
    browserLocationSnapshot.pathname === pathname &&
    browserLocationSnapshot.search === search
  ) {
    return browserLocationSnapshot;
  }

  browserLocationSnapshot = {
    pathname,
    search,
  };

  return browserLocationSnapshot;
}

function useBrowserLocation() {
  return useSyncExternalStore(
    subscribe,
    getLocationSnapshot,
    getLocationSnapshot,
  );
}

export function redirect(href: string): never {
  throw tanstackRedirect({
    href,
    throw: true,
  });
}

export function notFound(): never {
  throw tanstackNotFound({
    throw: true,
  });
}

export function useAppPathname() {
  return useBrowserLocation().pathname;
}

export function usePathname() {
  return useAppPathname();
}

export function useAppSearchParams() {
  const search = useBrowserLocation().search;

  return useMemo(() => new URLSearchParams(search), [search]);
}

export function useSearchParams() {
  return useAppSearchParams();
}

export function useAppRouter() {
  const router = useTanStackRouter({ warn: false });

  return useMemo(
    () => ({
      push(href: string, _options?: { scroll?: boolean }) {
        if (isExternalHref(href)) {
          window.location.assign(href);
          return Promise.resolve();
        }

        if (!router) {
          window.location.assign(href);
          return Promise.resolve();
        }

        return router.navigate({
          to: href as any,
        });
      },
      replace(href: string, _options?: { scroll?: boolean }) {
        if (isExternalHref(href)) {
          window.location.replace(href);
          return Promise.resolve();
        }

        if (!router) {
          window.location.replace(href);
          return Promise.resolve();
        }

        return router.navigate({
          to: href as any,
          replace: true,
        });
      },
      refresh() {
        if (!router) {
          window.location.reload();
          return Promise.resolve();
        }

        return router.invalidate();
      },
      prefetch(href: string) {
        if (!router || isExternalHref(href)) {
          return Promise.resolve();
        }

        return router.preloadRoute({
          to: href as any,
        });
      },
      back() {
        window.history.back();
      },
      forward() {
        window.history.forward();
      },
    }),
    [router],
  );
}

export function useRouter() {
  return useAppRouter();
}
