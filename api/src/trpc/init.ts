import { createLoggerWithContext } from "@tamias/logger";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { createTRPCContextFromHeaders, type TRPCContext } from "./context";
import { withTeamPermission } from "./middleware/team-permission";

export const DEBUG_PERF = process.env.DEBUG_PERF === "true";
const perfLogger = createLoggerWithContext("perf:trpc");
const serviceIdentityLogger = createLoggerWithContext("auth:service-identity");

export const createTRPCContext = async (
  _: unknown,
  c: {
    req: {
      raw: Request;
    };
    header: (name: string, value: string) => void;
  },
): Promise<TRPCContext> => {
  const ctxStart = DEBUG_PERF ? performance.now() : 0;

  const jwtStart = DEBUG_PERF ? performance.now() : 0;
  const context = await createTRPCContextFromHeaders(c.req.raw.headers, {
    setResponseHeader: c.header.bind(c),
  });
  const jwtMs = DEBUG_PERF ? performance.now() - jwtStart : 0;

  if (DEBUG_PERF) {
    perfLogger.info("context", {
      totalMs: +(performance.now() - ctxStart).toFixed(2),
      jwtVerifyMs: +jwtMs.toFixed(2),
      hasSession: !!context.session,
      requestId: context.requestId,
      cfRay: context.cfRay,
    });
  }

  return context;
};

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
  isServer: true,
  allowOutsideOfServer: true,
});

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;

const withTimingMiddleware = t.middleware(async (opts) => {
  if (!DEBUG_PERF) return opts.next();
  const start = performance.now();
  const result = await opts.next();
  perfLogger.info("procedure", {
    path: opts.path,
    type: opts.type,
    durationMs: +(performance.now() - start).toFixed(2),
  });
  return result;
});

const withTeamPermissionMiddleware = t.middleware(async (opts) => {
  return withTeamPermission({
    ctx: opts.ctx,
    procedurePath: opts.path,
    next: opts.next,
  });
});

export const publicProcedure = t.procedure.use(withTimingMiddleware);

export const protectedProcedure = t.procedure
  .use(withTimingMiddleware)
  .use(withTeamPermissionMiddleware)
  .use(async (opts) => {
    const { teamId, session } = opts.ctx;

    if (!session) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    return opts.next({
      ctx: {
        teamId,
        session,
      },
    });
  });

export function scopedInternalProcedure(requiredScope: string) {
  return t.procedure.use(withTimingMiddleware).use(async (opts) => {
    const { serviceIdentity } = opts.ctx;

    if (!serviceIdentity || !serviceIdentity.scopes.includes(requiredScope)) {
      serviceIdentityLogger.warn("Scoped internal request denied", {
        path: opts.path,
        requiredScope,
        serviceId: serviceIdentity?.id,
        keyId: serviceIdentity?.keyId,
        tokenId: serviceIdentity?.tokenId,
        requestId: opts.ctx.requestId,
      });
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    serviceIdentityLogger.info("Scoped internal request authorized", {
      path: opts.path,
      requiredScope,
      serviceId: serviceIdentity.id,
      keyId: serviceIdentity.keyId,
      tokenId: serviceIdentity.tokenId,
      requestId: opts.ctx.requestId,
    });

    return opts.next({ ctx: opts.ctx });
  });
}

/**
 * Procedure that accepts EITHER a valid user session OR a scoped service identity.
 * Use for endpoints called from both the dashboard (browser) and internal services
 * (async worker, etc.).
 */
export const protectedOrInternalProcedure = t.procedure
  .use(withTimingMiddleware)
  .use(async (opts) => {
    const { serviceIdentity, session } = opts.ctx;

    if (serviceIdentity?.scopes.includes("banking.read")) {
      serviceIdentityLogger.info("Scoped internal request authorized", {
        path: opts.path,
        requiredScope: "banking.read",
        serviceId: serviceIdentity.id,
        keyId: serviceIdentity.keyId,
        tokenId: serviceIdentity.tokenId,
        requestId: opts.ctx.requestId,
      });
      return opts.next({ ctx: opts.ctx });
    }

    if (!session) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    return opts.next({
      ctx: {
        ...opts.ctx,
        session,
      },
    });
  });
