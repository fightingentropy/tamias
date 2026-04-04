import { getStartContext } from "@tanstack/start-storage-context";
import {
  DEFAULT_ROOT_BOOTSTRAP,
  type RootBootstrapData,
} from "@/start/root-bootstrap";

export function resolveRootBootstrapData(): RootBootstrapData {
  const startContext = getStartContext({ throwIfNotFound: false });

  if (!startContext) {
    return DEFAULT_ROOT_BOOTSTRAP;
  }

  const auth = startContext.contextAfterGlobalMiddlewares?.auth as
    | {
        token?: string | null;
        refreshToken?: string | null;
      }
    | undefined;
  const canonicalHost = startContext.contextAfterGlobalMiddlewares
    ?.canonicalHost as RootBootstrapData["host"] | undefined;
  const requestUrl = new URL(startContext.request.url);
  const currentHost =
    startContext.request.headers.get("host") ?? requestUrl.host;

  return {
    auth: {
      token: auth?.token ?? null,
      refreshToken: auth?.refreshToken ?? null,
    },
    host: canonicalHost ?? {
      appUrl: requestUrl.origin,
      websiteUrl: requestUrl.origin,
      appHost: currentHost,
      websiteHost: currentHost,
      currentHost,
      isAppHost: true,
      isWebsiteHost: false,
    },
    fetchedAt: Date.now(),
  };
}
