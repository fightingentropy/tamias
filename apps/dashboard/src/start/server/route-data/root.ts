import { redirect } from "@tanstack/react-router";
import {
  getCanonicalHostContext,
  startContextAuth,
} from "@/start/server/route-data/shared";

export async function resolveIndexRoute() {
  const auth = startContextAuth();
  const host = getCanonicalHostContext();

  if (host.isAppHost) {
    throw redirect({
      to: auth.token ? "/dashboard" : "/login",
      throw: true,
    });
  }

  return {
    host,
  };
}
