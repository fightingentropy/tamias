import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { createAppPublicFileRoute } from "@/start/route-hosts";

export const loadIndexRoute = createServerFn({ method: "GET" }).handler(async () => {
  const { resolveIndexRoute } = await import("@/start/server/route-data/root");
  return resolveIndexRoute();
});

export const Route = createAppPublicFileRoute("/")({
  loader: () => loadIndexRoute(),
});
