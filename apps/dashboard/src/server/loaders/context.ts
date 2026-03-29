import "server-only";

import type { Database } from "@tamias/app-data/client";
import { db } from "@tamias/app-data/client";
import type { Session } from "@tamias/auth-session";
import { cache } from "react";
import { getServerRequestContext } from "@/trpc/request-context";

export const getCurrentSession = cache(async (): Promise<Session | null> => {
  const requestContext = await getServerRequestContext();
  return requestContext.session;
});

export const getRequestDb = cache(async (): Promise<Database> => db);
