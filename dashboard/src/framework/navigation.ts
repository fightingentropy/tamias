"use client";

import {
  notFound as tanstackNotFound,
  redirect as tanstackRedirect,
  useLocation as useTanStackLocation,
  useRouter as useTanStackRouter,
} from "@tanstack/react-router";
import { useMemo } from "react";

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

function useCurrentLocation() {
  return useTanStackLocation({
    select: (location) => ({
      pathname: location.pathname,
      search: location.searchStr,
    }),
  });
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
  return useCurrentLocation().pathname;
}

export function usePathname() {
  return useAppPathname();
}

export function useAppSearchParams() {
  const search = useCurrentLocation().search;

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
