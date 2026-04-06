import { ConvexHttpClient } from "convex/browser";
import { api } from "@tamias/app-data-convex/api";
import type { Id } from "@tamias/app-data-convex/data-model";
import {
  createUserSessionResolver,
  type SessionResolverDependencies,
  type SessionUserRecord,
} from "./index";

type ConvexUserId = Id<"appUsers">;

let sharedConvexClient: ConvexHttpClient | null = null;
let sharedConvexClientUrl: string | null = null;

function requireConvexUrl() {
  const convexUrl =
    process.env.CONVEX_URL || process.env.TAMIAS_CONVEX_URL || process.env.CONVEX_SITE_URL;

  if (!convexUrl) {
    throw new Error("Missing CONVEX_URL");
  }

  return convexUrl;
}

function getConvexServiceKey() {
  const configuredKey = process.env.CONVEX_SERVICE_KEY;

  if (configuredKey) {
    return configuredKey;
  }

  const convexUrl = requireConvexUrl();

  if (convexUrl.includes("127.0.0.1") || convexUrl.includes("localhost")) {
    return "local-dev";
  }

  throw new Error("Missing CONVEX_SERVICE_KEY");
}

function createConvexClient(token?: string) {
  const client = new ConvexHttpClient(requireConvexUrl(), { logger: false });

  if (token) {
    client.setAuth(token);
  }

  (client as { setFetchOptions?: (options: RequestInit) => void }).setFetchOptions?.({
    cache: "no-store",
  });

  return client;
}

function getSharedConvexClient() {
  const convexUrl = requireConvexUrl();

  if (!sharedConvexClient || sharedConvexClientUrl !== convexUrl) {
    sharedConvexClient = new ConvexHttpClient(convexUrl, { logger: false });
    sharedConvexClientUrl = convexUrl;
  }

  return sharedConvexClient;
}

function serviceArgs<T extends Record<string, unknown>>(args: T) {
  return {
    serviceKey: getConvexServiceKey(),
    ...args,
  };
}

async function getSessionFromConvex(accessToken?: string) {
  if (!accessToken) {
    return null;
  }

  const client = createConvexClient(accessToken);

  try {
    return (await client.query(api.identity.currentSession, {})) ?? null;
  } catch {
    return null;
  } finally {
    client.clearAuth();
  }
}

async function ensureCurrentAppUser(accessToken?: string): Promise<SessionUserRecord | null> {
  if (!accessToken) {
    return null;
  }

  const client = createConvexClient(accessToken);

  try {
    return (await client.mutation(api.identity.ensureCurrentAppUser, {})) ?? null;
  } catch {
    return null;
  } finally {
    client.clearAuth();
  }
}

export async function getCurrentUserFromConvex(args: {
  userId?: ConvexUserId;
  email?: string | null;
}) {
  return getSharedConvexClient().query(
    api.identity.serviceGetUserById,
    serviceArgs({
      userId: args.userId,
      email: args.email ?? undefined,
    }),
  );
}

async function getTeamMembershipIds(args: { userId?: ConvexUserId; email?: string | null }) {
  const teams = await getSharedConvexClient().query(
    api.identity.serviceListTeamsByUserId,
    serviceArgs({
      userId: args.userId,
      email: args.email ?? undefined,
    }),
  );

  return teams.map((team) => team.id);
}

const sessionResolverDependencies: SessionResolverDependencies = {
  getSessionFromConvex,
  ensureCurrentAppUser,
  getTeamMembershipIds,
  getCurrentUser: getCurrentUserFromConvex,
};

export const resolveConvexUserSession = createUserSessionResolver(sessionResolverDependencies);
