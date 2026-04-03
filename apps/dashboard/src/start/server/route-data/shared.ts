import { getConvexUrl } from "@tamias/utils/envs";
import { dehydrate } from "@tanstack/react-query";
import { redirect } from "@tanstack/react-router";
import { getStartContext } from "@tanstack/start-storage-context";
import {
  getCurrentTeamLocally,
  getCurrentUserLocally,
} from "@/server/loaders/identity";
import { getQueryClient, trpc } from "@/trpc/server";

export function getRequestUrl(input?: string) {
  if (input) {
    return new URL(input, "http://localhost");
  }

  return new URL(getStartContext().request.url);
}

export function getCanonicalHostContext() {
  const startContext = getStartContext();
  const requestUrl = new URL(startContext.request.url);
  const canonicalHost = startContext.contextAfterGlobalMiddlewares
    ?.canonicalHost as
    | {
        appHost: string;
        websiteHost: string;
        currentHost: string;
        isAppHost: boolean;
        isWebsiteHost: boolean;
      }
    | undefined;
  const currentHost = startContext.request.headers.get("host") ?? requestUrl.host;
  const appHost = canonicalHost?.appHost ?? currentHost;
  const websiteHost = canonicalHost?.websiteHost ?? currentHost;

  return {
    appHost,
    websiteHost,
    currentHost,
    isAppHost: canonicalHost?.isAppHost ?? true,
    isWebsiteHost: canonicalHost?.isWebsiteHost ?? false,
  };
}

export function dehydrateQueryClient(
  queryClient: ReturnType<typeof getQueryClient>,
) {
  return dehydrate(queryClient) as unknown as Record<string, {}>;
}

export function isLocalPublicReadUnavailable(error: unknown) {
  const convexUrl = getConvexUrl();
  const isLocalConvexUrl =
    convexUrl.includes("127.0.0.1:3210") || convexUrl.includes("localhost:3210");

  if (!isLocalConvexUrl || !error || typeof error !== "object") {
    return false;
  }

  if (error instanceof Error && error.message === "Network connection lost.") {
    return true;
  }

  const cause = "cause" in error ? (error as { cause?: unknown }).cause : null;

  if (!cause || typeof cause !== "object") {
    return false;
  }

  const networkError = cause as {
    code?: unknown;
    address?: unknown;
    port?: unknown;
  };

  return (
    networkError.code === "ECONNREFUSED" &&
    networkError.address === "127.0.0.1" &&
    networkError.port === 3210
  );
}

export async function buildBaseAppShellState(opts?: {
  allowIncomplete?: boolean;
}) {
  const queryClient = getQueryClient();
  const [team, user] = await Promise.all([
    getCurrentTeamLocally(),
    getCurrentUserLocally(),
  ]);

  if (!user) {
    throw redirect({
      to: "/login",
      throw: true,
    });
  }

  queryClient.setQueryData(trpc.team.current.queryKey(), team);
  queryClient.setQueryData(trpc.user.me.queryKey(), user);

  if (!opts?.allowIncomplete && (!user.fullName || !user.teamId)) {
    throw redirect({
      to: "/onboarding",
      throw: true,
    });
  }

  return {
    queryClient,
    user,
    team,
  };
}

export async function buildShellOnlyPageData(opts?: {
  allowIncomplete?: boolean;
}) {
  const { queryClient, user } = await buildBaseAppShellState(opts);

  return {
    dehydratedState: dehydrateQueryClient(queryClient),
    user,
  };
}

export function startContextAuth() {
  const startContext = getStartContext();

  return (startContext.contextAfterGlobalMiddlewares?.auth ?? {
    token: null,
    refreshToken: null,
  }) as {
    token: string | null;
    refreshToken: string | null;
  };
}
