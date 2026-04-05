import { createFileRoute } from "@tanstack/react-router"
import { createAppFileRoute } from "@/start/route-hosts";
import { createServerFn } from "@tanstack/react-start";

export const loadUpgradeData = createServerFn({ method: "GET" }).handler(async () => {
  const { buildUpgradePageData } = await import("@/start/server/route-data/misc");
  return (await buildUpgradePageData()) as any;
});

export const Route = createAppFileRoute("/upgrade")({
  loader: () => loadUpgradeData(),
  head: () => ({
    meta: [{ title: "Upgrade | Tamias" }],
  }),
});
