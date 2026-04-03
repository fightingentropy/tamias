import { createFileRoute } from "@tanstack/react-router"
import { createSharedPublicFileRoute } from "@/start/route-hosts";
import { createServerFn } from "@tanstack/react-start";

export const loadIndexRoute = createServerFn({ method: "GET" }).handler(async () => {
  const { resolveIndexRoute } = await import("@/start/server/route-data/root");
  return resolveIndexRoute();
});

export const Route = createSharedPublicFileRoute("/")({
  loader: () => loadIndexRoute(),
});
