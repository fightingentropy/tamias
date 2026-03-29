import { getTeamMembershipIdsFromConvex } from "@tamias/app-services/identity";
import type { Session } from "@tamias/auth-session";
import type { Database } from "@tamias/app-data/client";
import { createLoggerWithContext } from "@tamias/logger";
import { TRPCError } from "@trpc/server";

const DEBUG_PERF = process.env.DEBUG_PERF === "true";
const perfLogger = createLoggerWithContext("perf:trpc");
const teamPermissionLogger = createLoggerWithContext("trpc:team-permission");

type TeamResolution = {
  teamId: string | null;
};

const resolveCache = new WeakMap<object, Promise<TeamResolution>>();

async function resolveTeamPermission(
  session: Session | undefined | null,
  procedurePath?: string,
  requestId?: string,
  cfRay?: string,
): Promise<TeamResolution> {
  const resolveStart = DEBUG_PERF ? performance.now() : 0;
  const userId = session?.user?.id;

  if (!userId) {
    teamPermissionLogger.warn("permission denied: missing user id", {
      procedurePath,
      hasSession: !!session,
      requestId,
      cfRay,
    });
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "No permission to access this team",
    });
  }

  if (session.teamMembershipIds) {
    const teamId = session.teamId ?? null;

    if (teamId !== null && !session.teamMembershipIds.includes(teamId)) {
      teamPermissionLogger.warn("permission denied: user has no team access", {
        procedurePath,
        userId,
        teamId,
        requestId,
        cfRay,
      });
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "No permission to access this team",
      });
    }

    if (DEBUG_PERF) {
      perfLogger.info("teamPermission", {
        totalMs: +(performance.now() - resolveStart).toFixed(2),
        dbQueryMs: 0,
        teamId,
        source: "session",
      });
    }

    return { teamId };
  }

  const convexStart = DEBUG_PERF ? performance.now() : 0;
  const teamMembershipIds = await getTeamMembershipIdsFromConvex({
    userId: session?.user?.convexId,
    email: session?.user?.email ?? null,
  });
  const convexMs = DEBUG_PERF ? performance.now() - convexStart : 0;

  if (teamMembershipIds.length === 0 && session?.teamId) {
    teamPermissionLogger.warn("permission denied: user has no team access", {
      procedurePath,
      userId,
      teamId: session.teamId,
      requestId,
      cfRay,
    });
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "No permission to access this team",
    });
  }

  const teamId = session?.teamId ?? null;

  if (teamId !== null) {
    const hasAccess = teamMembershipIds.includes(teamId);

    if (!hasAccess) {
      teamPermissionLogger.warn("permission denied: user has no team access", {
        procedurePath,
        userId,
        teamId,
        requestId,
        cfRay,
      });
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "No permission to access this team",
      });
    }
  }

  if (DEBUG_PERF) {
    perfLogger.info("teamPermission", {
      totalMs: +(performance.now() - resolveStart).toFixed(2),
      dbQueryMs: +convexMs.toFixed(2),
      teamId,
      source: "convex",
    });
  }

  return { teamId };
}

export const withTeamPermission = async <TReturn>(opts: {
  ctx: {
    session?: Session | null;
    db: Database;
    requestId?: string;
    cfRay?: string;
  };
  procedurePath?: string;
  next: (opts: {
    ctx: {
      session?: Session | null;
      db: Database;
      teamId: string | null;
    };
  }) => Promise<TReturn>;
}) => {
  const { ctx, next } = opts;

  let resolution = resolveCache.get(ctx);
  if (!resolution) {
    resolution = resolveTeamPermission(
      ctx.session,
      opts.procedurePath,
      ctx.requestId,
      ctx.cfRay,
    );
    resolveCache.set(ctx, resolution);
  }

  const { teamId } = await resolution;

  return next({
    ctx: {
      session: ctx.session,
      teamId,
      db: ctx.db,
    },
  });
};
