import { createFileRoute } from "@tanstack/react-router"
import { createAppFileRoute } from "@/start/route-hosts";
import { createServerFn } from "@tanstack/react-start";

export const loadAccountTeamsData = createServerFn({ method: "GET" }).handler(
  async () => {
    const { buildAccountTeamsPageData } = await import(
      "@/start/server/route-data/account"
    );
    return (await buildAccountTeamsPageData()) as any;
  },
);

export const Route = createAppFileRoute("/account/teams")({
  loader: () => loadAccountTeamsData(),
  head: () => ({
    meta: [{ title: "Teams | Tamias" }],
  }),
});
