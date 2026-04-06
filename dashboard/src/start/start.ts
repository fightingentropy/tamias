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
const LOCAL_LEGACY_HOSTNAMES = new Set(["tamias.test"]);
const PRODUCTION_LEGACY_HOSTNAMES = new Set(["tamias.xyz", "www.tamias.xyz"]);

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

  if (
    currentHostname === LOCAL_APP_HOSTNAME ||
    LOCAL_LEGACY_HOSTNAMES.has(currentHostname)
  ) {
    const port = requestUrl.port ? `:${requestUrl.port}` : "";

    return {
      appUrl: `${requestUrl.protocol}//${LOCAL_APP_HOSTNAME}${port}`,
      isAppHost: currentHostname === LOCAL_APP_HOSTNAME,
    };
  }

  if (
    currentHostname === PRODUCTION_APP_HOSTNAME ||
    PRODUCTION_LEGACY_HOSTNAMES.has(currentHostname)
  ) {
    return {
      appUrl: "https://app.tamias.xyz",
      isAppHost: currentHostname === PRODUCTION_APP_HOSTNAME,
    };
  }

  return {
    appUrl: requestUrl.origin,
    isAppHost: true,
  };
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
  const { appUrl, isAppHost } = getCanonicalAppOrigin(requestUrl, currentHost);
  const pathname = requestUrl.pathname || "/";
  let auth = createAnonymousRequestAuthContext();

  if (!isAppHost) {
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
