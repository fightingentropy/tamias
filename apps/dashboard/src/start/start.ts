import "@/start/html-element-shim";
import { createStart, createMiddleware } from "@tanstack/react-start";
import { getRouteHostPolicy } from "@/start/route-host-policy";
import {
  createAnonymousRequestAuthContext,
  middlewareRedirect,
  resolveRequestAuthContext,
} from "@/start/auth/server";

const LOCAL_WEBSITE_HOSTNAME = "tamias.test";
const LOCAL_APP_HOSTNAME = "app.tamias.test";
const PRODUCTION_WEBSITE_HOSTNAMES = new Set(["tamias.xyz", "www.tamias.xyz"]);
const PRODUCTION_APP_HOSTNAME = "app.tamias.xyz";

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

  if (
    currentHostname === PRODUCTION_APP_HOSTNAME ||
    PRODUCTION_WEBSITE_HOSTNAMES.has(currentHostname)
  ) {
    return {
      appUrl: "https://app.tamias.xyz",
      websiteUrl: "https://tamias.xyz",
    };
  }

  return {
    appUrl: requestUrl.origin,
    websiteUrl: requestUrl.origin,
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
    const pathname = requestUrl.pathname || "/";
    let auth = createAnonymousRequestAuthContext();

    if (!isStaticAssetPath(pathname)) {
      const routeHostPolicy = getRouteHostPolicy(requestUrl);

      if (pathname === "/site" || pathname.startsWith("/site/")) {
        const cleanPath = pathname === "/site" ? "/" : pathname.slice("/site".length);
        const cleanUrl = new URL(`${cleanPath}${requestUrl.search}`, requestUrl.origin);
        const cleanPolicy = getRouteHostPolicy(cleanUrl);
        const redirectBase =
          cleanPolicy?.hostSurface === "app" ? appUrl : websiteUrl;
        return middlewareRedirect(
          request,
          new URL(`${cleanPath}${requestUrl.search}`, redirectBase).toString(),
        );
      }

      if (isWebsiteHost && routeHostPolicy?.hostSurface === "app") {
        return middlewareRedirect(
          request,
          new URL(`${pathname}${requestUrl.search}`, appUrl).toString(),
        );
      }

      if (isAppHost && routeHostPolicy?.hostSurface === "website") {
        return middlewareRedirect(
          request,
          new URL(`${pathname}${requestUrl.search}`, websiteUrl).toString(),
        );
      }

      if (!routeHostPolicy && isAppHost) {
        return middlewareRedirect(
          request,
          new URL(`${pathname}${requestUrl.search}`, websiteUrl).toString(),
        );
      }

      const shouldResolveAuth =
        !isWebsiteHost || routeHostPolicy?.hostSurface === "app";

      if (shouldResolveAuth) {
        auth = await resolveRequestAuthContext(request);
      }

      if (
        !auth.token &&
        !isWebsiteHost &&
        routeHostPolicy?.appHostAccess === "protected"
      ) {
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
