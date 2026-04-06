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

  return {
    auth: {
      token: auth?.token ?? null,
      refreshToken: auth?.refreshToken ?? null,
    },
    fetchedAt: Date.now(),
  };
}
