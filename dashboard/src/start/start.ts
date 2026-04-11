import "@/start/html-element-shim";
import { createMiddleware, createStart } from "@tanstack/react-start";
import {
  createAnonymousRequestAuthContext,
  middlewareRedirect,
  resolveRequestAuthContext,
} from "@/start/auth/server";
import { getRouteHostPolicy } from "@/start/route-host-policy";

const LOCAL_APP_HOSTNAME = "app.tamias.test";
const PRODUCTION_APP_HOSTNAME = "app.tamias.xyz";
const LOCAL_APP_HOSTNAMES = new Set([LOCAL_APP_HOSTNAME, "tamias.test"]);
const PRODUCTION_APP_HOSTNAMES = new Set([PRODUCTION_APP_HOSTNAME, "tamias.xyz", "www.tamias.xyz"]);

// These hostnames serve the public landing page at "/" but redirect all other
// paths to the canonical app hostname so auth cookies work correctly.
const LOCAL_LANDING_ONLY_HOSTNAMES = new Set(["tamias.test"]);
const PRODUCTION_LANDING_ONLY_HOSTNAMES = new Set(["tamias.xyz", "www.tamias.xyz"]);

function isStaticAssetPath(pathname: string) {
  return (
    pathname.startsWith("/assets/") ||
    pathname.startsWith("/images/") ||
    pathname.startsWith("/stories/") ||
    pathname.startsWith("/email/") ||
    pathname.startsWith("/.well-known/") ||
    /\.[a-z0-9]+$/i.test(pathname)
  );
}

function isInternalFrameworkPath(pathname: string) {
  return pathname.startsWith("/_serverFn") || pathname.startsWith("/_server");
}

function getHostname(host: string) {
  return host.split(":")[0]?.toLowerCase() ?? "";
}

function getCanonicalAppOrigin(requestUrl: URL, currentHost: string) {
  const currentHostname = getHostname(currentHost);

  // Canonical app hostnames — serve everything
  if (currentHostname === LOCAL_APP_HOSTNAME || currentHostname === PRODUCTION_APP_HOSTNAME) {
    return { appUrl: requestUrl.origin, isAppHost: true, isLandingOnly: false };
  }

  // Landing-only hostnames — serve "/" but redirect everything else to canonical
  if (LOCAL_LANDING_ONLY_HOSTNAMES.has(currentHostname)) {
    const port = requestUrl.port ? `:${requestUrl.port}` : "";
    return {
      appUrl: `${requestUrl.protocol}//${LOCAL_APP_HOSTNAME}${port}`,
      isAppHost: true,
      isLandingOnly: true,
    };
  }

  if (PRODUCTION_LANDING_ONLY_HOSTNAMES.has(currentHostname)) {
    return {
      appUrl: `https://${PRODUCTION_APP_HOSTNAME}`,
      isAppHost: true,
      isLandingOnly: true,
    };
  }

  return { appUrl: requestUrl.origin, isAppHost: true, isLandingOnly: false };
}

const requestMiddleware = createMiddleware({ type: "request" }).server((async ({
  next,
  request,
}: {
  next: any;
  request: Request;
}) => {
  const requestUrl = new URL(request.url);
  const currentHost = request.headers.get("host") ?? requestUrl.host;
  const { appUrl, isAppHost, isLandingOnly } = getCanonicalAppOrigin(requestUrl, currentHost);
  const pathname = requestUrl.pathname || "/";
  let auth = createAnonymousRequestAuthContext();

  if (!isAppHost) {
    return middlewareRedirect(
      request,
      new URL(`${pathname}${requestUrl.search}`, appUrl).toString(),
    );
  }

  // Landing-only hosts (tamias.xyz, www.tamias.xyz) serve "/" but redirect
  // all other paths to app.tamias.xyz so auth cookies work correctly.
  // Static assets are allowed through so the landing page can load its CSS/JS.
  if (isLandingOnly && pathname !== "/" && !isStaticAssetPath(pathname)) {
    return middlewareRedirect(
      request,
      new URL(`${pathname}${requestUrl.search}`, appUrl).toString(),
    );
  }

  if (!isStaticAssetPath(pathname)) {
    auth = await resolveRequestAuthContext(request);

    const routeAccess = getRouteHostPolicy(requestUrl);

    if (!auth.token && routeAccess === "protected") {
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
    },
  })) as Exclude<Awaited<ReturnType<typeof next>>, void>;

  for (const cookieHeader of auth.cookieHeaders) {
    result.response.headers.append("set-cookie", cookieHeader);
  }

  return result;
}) as any);

export const startInstance = createStart(() => ({
  requestMiddleware: [requestMiddleware],
}));
