import "@/start/html-element-shim";
import { createStart, createMiddleware } from "@tanstack/react-start";
import { getAppUrl, getWebsiteUrl } from "@tamias/utils/envs";
import { middlewareRedirect, resolveRequestAuthContext } from "@/start/auth/server";

const DASHBOARD_URL = getAppUrl();
const WEBSITE_URL = getWebsiteUrl();
const LOCAL_WEBSITE_HOSTNAME = "tamias.test";
const LOCAL_APP_HOSTNAME = "app.tamias.test";

const APP_ONLY_EXACT_PATHS = new Set([
  "/account",
  "/apps",
  "/chat",
  "/compliance",
  "/dashboard",
  "/invoices",
  "/mfa",
  "/oauth",
  "/onboarding",
  "/settings",
  "/teams",
  "/tracker",
  "/upgrade",
  "/vault",
]);

const APP_ONLY_NESTED_PREFIXES = [
  "/account/",
  "/apps/",
  "/chat/",
  "/compliance/",
  "/dashboard/",
  "/inbox/",
  "/invoices/",
  "/mfa/",
  "/oauth/",
  "/onboarding/",
  "/settings/",
  "/teams/",
  "/tracker/",
  "/transactions/",
  "/upgrade/",
  "/vault/",
];

const SHARED_HOST_PATHS = new Set([
  "/customers",
  "/inbox",
  "/transactions",
]);

function isAppOnlyPath(pathname: string) {
  return (
    APP_ONLY_EXACT_PATHS.has(pathname) ||
    APP_ONLY_NESTED_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

function isSharedHostPath(pathname: string) {
  return SHARED_HOST_PATHS.has(pathname);
}

function isStaticAssetPath(pathname: string) {
  return (
    pathname.startsWith("/_server") ||
    pathname.startsWith("/assets/") ||
    pathname.startsWith("/images/") ||
    pathname.startsWith("/stories/") ||
    pathname.startsWith("/email/") ||
    pathname.startsWith("/.well-known/") ||
    /\.[a-z0-9]+$/i.test(pathname)
  );
}

function isAppPublicPath(pathname: string) {
  return (
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/verify" ||
    pathname === "/oauth-callback" ||
    pathname.startsWith("/i/") ||
    pathname.startsWith("/p/") ||
    pathname.startsWith("/s/") ||
    pathname.startsWith("/r/") ||
    pathname.startsWith("/api/")
  );
}

function isWebsitePath(pathname: string) {
  return (
    !isAppPublicPath(pathname) &&
    !isAppOnlyPath(pathname) &&
    !isSharedHostPath(pathname)
  );
}

function getHostname(host: string) {
  return host.split(":")[0]?.toLowerCase() ?? "";
}

function getCanonicalOrigins(requestUrl: URL, currentHost: string) {
  const currentHostname = getHostname(currentHost);

  if (
    currentHostname === LOCAL_WEBSITE_HOSTNAME ||
    currentHostname === LOCAL_APP_HOSTNAME
  ) {
    const port = requestUrl.port ? `:${requestUrl.port}` : "";

    return {
      appUrl: `${requestUrl.protocol}//${LOCAL_APP_HOSTNAME}${port}`,
      websiteUrl: `${requestUrl.protocol}//${LOCAL_WEBSITE_HOSTNAME}${port}`,
    };
  }

  return {
    appUrl: DASHBOARD_URL,
    websiteUrl: WEBSITE_URL,
  };
}

const requestMiddleware = createMiddleware({ type: "request" }).server(
  (async ({ next, request }: { next: any; request: Request }) => {
    const requestUrl = new URL(request.url);
    const currentHost = request.headers.get("host") ?? requestUrl.host;
    const currentHostname = getHostname(currentHost);
    const { appUrl, websiteUrl } = getCanonicalOrigins(requestUrl, currentHost);
    const appHost = new URL(appUrl).host;
    const websiteHost = new URL(websiteUrl).host;
    const appHostname = new URL(appUrl).hostname;
    const websiteHostname = new URL(websiteUrl).hostname;
    const distinctHosts = appHost !== websiteHost;
    const isWebsiteHost = distinctHosts && currentHostname === websiteHostname;
    const isAppHost = !distinctHosts || currentHostname === appHostname;
    const auth = await resolveRequestAuthContext(request);
    const pathname = requestUrl.pathname || "/";

    if (!isStaticAssetPath(pathname)) {
      if (pathname === "/site" || pathname.startsWith("/site/")) {
        const cleanPath = pathname === "/site" ? "/" : pathname.slice("/site".length);
        const redirectBase = isWebsitePath(cleanPath) ? websiteUrl : appUrl;
        return middlewareRedirect(
          request,
          new URL(`${cleanPath}${requestUrl.search}`, redirectBase).toString(),
        );
      }

      if (isWebsiteHost && (isAppPublicPath(pathname) || isAppOnlyPath(pathname))) {
        return middlewareRedirect(
          request,
          new URL(`${pathname}${requestUrl.search}`, appUrl).toString(),
        );
      }

      if (isAppHost && isWebsitePath(pathname)) {
        return middlewareRedirect(
          request,
          new URL(`${pathname}${requestUrl.search}`, websiteUrl).toString(),
        );
      }

      if (!auth.token && !isAppPublicPath(pathname) && !isWebsiteHost) {
        const encodedPath = `${pathname.replace(/^\/+/, "")}${requestUrl.search}`;
        const loginPath = encodedPath
          ? `/login?return_to=${encodeURIComponent(encodedPath)}`
          : "/login";

        return middlewareRedirect(request, loginPath);
      }
    }

    const result = (await next({
      context: {
        auth,
        canonicalHost: {
          appHost,
          websiteHost,
          currentHost,
          isAppHost,
          isWebsiteHost,
        },
      },
    })) as Exclude<Awaited<ReturnType<typeof next>>, void>;

    for (const cookieHeader of auth.cookieHeaders) {
      result.response.headers.append("set-cookie", cookieHeader);
    }

    return result;
  }) as any,
);

export const startInstance = createStart(() => ({
  requestMiddleware: [requestMiddleware],
}));
