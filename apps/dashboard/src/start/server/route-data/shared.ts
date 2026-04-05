import { dehydrate } from "@tanstack/react-query";
import { redirect } from "@tanstack/react-router";
import { getStartContext } from "@tanstack/start-storage-context";
import { getQueryClient, trpc } from "@/trpc/server";

export function getRequestUrl(input?: string) {
  if (input) {
    return new URL(input, "http://localhost");
  }

  return new URL(getStartContext().request.url);
}

export function dehydrateQueryClient(
  queryClient: ReturnType<typeof getQueryClient>,
) {
  return dehydrate(queryClient) as unknown as Record<string, {}>;
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
    if (isUnauthorizedQueryError(userResult.reason)) {
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
    if (isUnauthorizedQueryError(teamResult.reason)) {
      throw redirect({
        to: "/login",
        throw: true,
      });
    }

    throw teamResult.reason;
  }

  const team = teamResult.value;

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
