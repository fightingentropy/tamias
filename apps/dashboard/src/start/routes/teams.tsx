import { createFileRoute } from "@tanstack/react-router"
import { createAppFileRoute } from "@/start/route-hosts";
import { createServerFn } from "@tanstack/react-start";

export const loadTeamsData = createServerFn({ method: "GET" }).handler(async () => {
  const { buildTeamsSelectionPageData } = await import(
    "@/start/server/route-data/misc"
  );
  return (await buildTeamsSelectionPageData()) as any;
});

export const Route = createAppFileRoute("/teams")({
  loader: () => loadTeamsData(),
  head: () => ({
    meta: [{ title: "Teams | Tamias" }],
  }),
});
