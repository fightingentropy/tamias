"use client";

import { useRouter } from "@tanstack/react-router";
import type { ComponentPropsWithoutRef, MouseEvent } from "react";
import { forwardRef } from "react";

type LinkProps = Omit<ComponentPropsWithoutRef<"a">, "href"> & {
  href: string | URL;
  prefetch?: boolean;
  replace?: boolean;
  scroll?: boolean;
};

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

function shouldHandleClientNavigation(
  event: MouseEvent<HTMLAnchorElement>,
  href: string,
  target?: string,
  download?: unknown,
) {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.altKey ||
    event.ctrlKey ||
    event.shiftKey
  ) {
    return false;
  }

  if (
    target ||
    download ||
    href.startsWith("#") ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:") ||
    isExternalHref(href)
  ) {
    return false;
  }

  return true;
}

const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { href, onClick, onMouseEnter, onFocus, prefetch, replace, ...props },
  ref,
) {
  const router = useRouter({ warn: false });
  const hrefString = typeof href === "string" ? href : href.toString();

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);

    if (!router) {
      return;
    }

    if (!shouldHandleClientNavigation(event, hrefString, props.target, props.download)) {
      return;
    }

    event.preventDefault();
    void router.navigate({
      to: hrefString as any,
      replace,
    });
  };

  const preloadRoute = () => {
    if (!router || !prefetch || isExternalHref(hrefString) || hrefString.startsWith("#")) {
      return;
    }

    void router.preloadRoute({
      to: hrefString as any,
    });
  };

  return (
    <a
      ref={ref}
      href={hrefString}
      onClick={handleClick}
      onMouseEnter={(event) => {
        onMouseEnter?.(event);
        preloadRoute();
      }}
      onFocus={(event) => {
        onFocus?.(event);
        preloadRoute();
      }}
      {...props}
    />
  );
});

export default Link;
