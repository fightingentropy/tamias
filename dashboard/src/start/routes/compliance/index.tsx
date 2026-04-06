import { createFileRoute } from "@tanstack/react-router";
import { createAppFileRoute } from "@/start/route-hosts";
import { createServerFn } from "@tanstack/react-start";

export const loadComplianceData = createServerFn({ method: "GET" }).handler(async () => {
  const { buildCompliancePageData } = await import("@/start/server/route-data/compliance");
  return await buildCompliancePageData();
});

export const Route = createAppFileRoute("/compliance/")({
  loader: () => loadComplianceData(),
  head: () => ({
    meta: [{ title: "Compliance | Tamias" }],
  }),
});
