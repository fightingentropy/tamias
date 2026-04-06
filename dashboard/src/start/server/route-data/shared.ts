import { dehydrate } from "@tanstack/react-query";
import { redirect } from "@tanstack/react-router";
import { getStartContext } from "@tanstack/start-storage-context";
import { getQueryClient, trpc } from "@/trpc/server";
import { hasCompletedOnboarding } from "@/utils/auth-routing";

export function getRequestUrl(input?: string) {
  if (input) {
    return new URL(input, "http://localhost");
  }

  return new URL(getStartContext().request.url);
}

export function dehydrateQueryClient(
  queryClient: ReturnType<typeof getQueryClient>,
) {
  // TanStack serializable shape for dehydrated query client state (see ValidateSerializable).
  // biome-ignore lint/complexity/noBannedTypes: matches router-core index signature for nested `{}` nodes
  return dehydrate(queryClient) as unknown as { [key: string]: {} };
}

export function isUnauthorizedQueryError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeTrpcError = error as {
    data?: { code?: unknown };
    message?: unknown;
  };

  return (
    maybeTrpcError.data?.code === "UNAUTHORIZED" ||
    (typeof maybeTrpcError.message === "string" &&
      maybeTrpcError.message.toUpperCase().includes("UNAUTHORIZED"))
  );
}

const QUERY_TRANSPORT_MESSAGE_RE =
  /fetch failed|Failed to fetch|Network connection lost|ECONNREFUSED|connection refused|Load failed|network error|ENOTFOUND|ETIMEDOUT|timed out|AbortError|aborted|ECONNRESET|socket hang up/i;

function collectErrorMessages(error: unknown, depth = 0): string {
  if (depth > 6 || error == null) {
    return "";
  }

  const parts: string[] = [];

  if (error instanceof Error) {
    parts.push(error.message);
  } else if (typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") {
      parts.push(message);
    }
  }

  const cause =
    error instanceof Error
      ? error.cause
      : typeof error === "object" &&
          error !== null &&
          "cause" in error &&
          (error as { cause?: unknown }).cause !== undefined
        ? (error as { cause: unknown }).cause
        : undefined;

  if (cause !== undefined) {
    const nested = collectErrorMessages(cause, depth + 1);
    if (nested) {
      parts.push(nested);
    }
  }

  return parts.filter(Boolean).join(" | ");
}

/**
 * tRPC over HTTP failed before a JSON error body (API down, DNS, TLS, timeout, etc.).
 * Treat like unauthenticated for loaders so local dev without `bun run dev` / API is not a hard crash.
 */
export function isQueryTransportError(error: unknown): boolean {
  return QUERY_TRANSPORT_MESSAGE_RE.test(collectErrorMessages(error));
}

export function isNotFoundQueryError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeTrpcError = error as {
    data?: { code?: unknown };
    message?: unknown;
  };

  return (
    maybeTrpcError.data?.code === "NOT_FOUND" ||
    (typeof maybeTrpcError.message === "string" &&
      maybeTrpcError.message.toUpperCase().includes("NOT_FOUND"))
  );
}

export async function buildBaseAppShellState(opts?: {
  allowIncomplete?: boolean;
}) {
  const queryClient = getQueryClient();
  const currentTeamQuery = trpc.team.current.queryOptions();
  const currentUserQuery = trpc.user.me.queryOptions();
  const [teamResult, userResult] = await Promise.allSettled([
    queryClient.fetchQuery(currentTeamQuery),
    queryClient.fetchQuery(currentUserQuery),
  ]);

  if (userResult.status === "rejected") {
    if (
      isUnauthorizedQueryError(userResult.reason) ||
      isQueryTransportError(userResult.reason)
    ) {
      throw redirect({
        to: "/login",
        throw: true,
      });
    }

    throw userResult.reason;
  }

  const user = userResult.value;

  if (!user) {
    throw redirect({
      to: "/login",
      throw: true,
    });
  }

  if (teamResult.status === "rejected") {
    if (
      isUnauthorizedQueryError(teamResult.reason) ||
      isQueryTransportError(teamResult.reason)
    ) {
      throw redirect({
        to: "/login",
        throw: true,
      });
    }

    throw teamResult.reason;
  }

  const team = teamResult.value;

  if (!opts?.allowIncomplete && !hasCompletedOnboarding(user)) {
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
