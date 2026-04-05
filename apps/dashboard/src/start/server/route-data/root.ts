import { redirect } from "@tanstack/react-router";
import { startContextAuth } from "@/start/server/route-data/shared";

export async function resolveIndexRoute() {
  const auth = startContextAuth();
  throw redirect({
    to: auth.token ? "/dashboard" : "/login",
    throw: true,
  });
}
