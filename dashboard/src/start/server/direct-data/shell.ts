import { createDatabase, type CloudflareD1DatabaseBinding } from "@tamias/app-data/client";
import { getApiKeyByTokenFromD1, touchApiKeyInD1 } from "@tamias/app-services/foundation";
import {
  getCurrentTeamForAccessToken,
  getCurrentUser,
  getTeamById,
  getTeamMembershipIds,
} from "@tamias/app-services/identity";
import { ensureCurrentUser } from "@tamias/app-services/identity";
import {
  getOAuthAccessTokenByTokenFromD1,
  touchOAuthAccessTokenInD1,
} from "@tamias/app-services/oauth";
import { resolveRequestAuth, verifyAccessToken, type Session } from "@tamias/auth-session";
import { generateOptionalFileKey } from "@tamias/encryption";
import { getStartContext } from "@tanstack/start-storage-context";
import { getServerRequestContext } from "@/trpc/request-context";
import { trpc, type getQueryClient } from "@/trpc/server";

type DashboardEnvWithData = {
  APP_DB?: CloudflareD1DatabaseBinding;
};

type QueryClient = ReturnType<typeof getQueryClient>;

export class DirectRouteDataError extends Error {
  readonly data: { code: "UNAUTHORIZED" | "FORBIDDEN" };

  constructor(code: "UNAUTHORIZED" | "FORBIDDEN", message: string = code) {
    super(message);
    this.name = "DirectRouteDataError";
    this.data = { code };
  }
}

function getDashboardD1Binding() {
  const startContext = getStartContext({ throwIfNotFound: false });
  const env = startContext?.contextAfterGlobalMiddlewares?.cloudflare?.env as
    | DashboardEnvWithData
    | null
    | undefined;

  return env?.APP_DB ?? null;
}

async function buildAuthHeaders() {
  const requestContext = await getServerRequestContext();
  const headers = new Headers();

  if (requestContext.token) {
    headers.set("Authorization", `Bearer ${requestContext.token}`);
  }

  return {
    headers,
    accessToken: requestContext.token ?? null,
  };
}

async function resolveTeamId(db: ReturnType<typeof createDatabase>, session: Session | null) {
  const userId = session?.user?.id;

  if (!userId) {
    throw new DirectRouteDataError("UNAUTHORIZED", "No permission to access this team");
  }

  const membershipIds =
    session.teamMembershipIds ??
    (await getTeamMembershipIds({
      userId,
      email: session.user.email ?? null,
      db,
    }));

  const teamId = session.teamId ?? null;

  if (teamId !== null && !membershipIds.includes(teamId)) {
    throw new DirectRouteDataError("FORBIDDEN", "No permission to access this team");
  }

  if (membershipIds.length === 0 && session.teamId) {
    throw new DirectRouteDataError("FORBIDDEN", "No permission to access this team");
  }

  return teamId;
}

export async function prefetchDirectShellData(queryClient: QueryClient) {
  const d1 = getDashboardD1Binding();

  if (!d1) {
    return null;
  }

  const db = createDatabase({ cloudflare: { d1 } });
  const { headers, accessToken } = await buildAuthHeaders();

  const auth = await resolveRequestAuth(headers, {
    internalApiKey: process.env.INTERNAL_API_KEY,
    resolveUserSession: async (token) => {
      const identity = await verifyAccessToken(token);
      const user = await ensureCurrentUser(token, identity, db);

      if (!user?.id) {
        return null;
      }

      const teamMembershipIds = await getTeamMembershipIds({
        userId: user.id,
        email: user.email ?? identity?.email ?? null,
        db,
      });

      return {
        teamId: user.teamId ?? undefined,
        teamMembershipIds,
        user: {
          id: user.id,
          email: user.email ?? identity?.email ?? undefined,
          full_name: user.fullName ?? identity?.full_name,
        },
      };
    },
    async getOAuthAccessTokenByToken(token) {
      return getOAuthAccessTokenByTokenFromD1(token, db);
    },
    async getApiKeyByToken(token) {
      const record = await getApiKeyByTokenFromD1(token, db);

      if (!record?.teamId || !record.user?.id) {
        return null;
      }

      return {
        id: record.id,
        teamId: record.teamId,
        scopes: record.scopes ?? [],
        user: {
          id: record.user.id,
          email: record.user.email ?? undefined,
          fullName: record.user.fullName ?? undefined,
        },
      };
    },
    async touchOAuthAccessToken(id) {
      await touchOAuthAccessTokenInD1(id, db);
    },
    async touchApiKey(id) {
      await touchApiKeyInD1(id, db);
    },
  });

  const teamId = await resolveTeamId(db, auth.session);
  const rawUser = await getCurrentUser({
    userId: auth.session?.user.id,
    email: auth.session?.user.email ?? null,
    db,
  });

  const user = rawUser
    ? {
        ...rawUser,
        fileKey: await generateOptionalFileKey(rawUser.teamId),
      }
    : undefined;

  const team =
    teamId && accessToken && !accessToken.startsWith("mid_")
      ? ((await getCurrentTeamForAccessToken(accessToken, db)) ?? (await getTeamById(teamId, db)))
      : teamId
        ? await getTeamById(teamId, db)
        : null;

  queryClient.setQueryData(trpc.user.me.queryKey(), user);
  queryClient.setQueryData(trpc.team.current.queryKey(), team);

  return {
    user,
    team,
  };
}
