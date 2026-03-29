import {
  convexAuthNextjsMiddleware,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";
import { createI18nMiddleware } from "next-international/middleware";

const ORIGIN = process.env.NEXT_PUBLIC_URL || "http://localhost:3001";
const LOCALES = ["en"] as const;

const I18nMiddleware = createI18nMiddleware({
  locales: LOCALES,
  defaultLocale: "en",
  urlMappingStrategy: "rewrite",
});

function isPublicPath(pathname: string) {
  return (
    pathname === "/" ||
    pathname === "/login" ||
    pathname.startsWith("/i/") ||
    pathname.startsWith("/p/") ||
    pathname.startsWith("/s/") ||
    pathname.startsWith("/r/")
  );
}

export default convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  const response = I18nMiddleware(request);
  const nextUrl = request.nextUrl;

  const pathnameLocale = nextUrl.pathname.split("/")[1] ?? "";
  const hasLocalePrefix = LOCALES.includes(
    pathnameLocale as (typeof LOCALES)[number],
  );
  const pathnameWithoutLocale = hasLocalePrefix
    ? nextUrl.pathname.slice(pathnameLocale.length + 1) || "/"
    : nextUrl.pathname;

  const newUrl = new URL(pathnameWithoutLocale || "/", ORIGIN);

  const encodedSearchParams = `${newUrl?.pathname?.substring(1)}${
    newUrl.search
  }`;

  if (!(await convexAuth.isAuthenticated()) && !isPublicPath(newUrl.pathname)) {
    const route = encodedSearchParams
      ? `/login?return_to=${encodeURIComponent(encodedSearchParams)}`
      : "/login";

    return nextjsMiddlewareRedirect(request, route);
  }

  return response;
});

export const config = {
  matcher: [
    "/((?!api|_next|.*\\..*).*)",
    "/api/auth/:path*",
  ],
};
