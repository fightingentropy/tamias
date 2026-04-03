import { createFileRoute } from "@tanstack/react-router"
import { createAppFileRoute } from "@/start/route-hosts";
import { createServerFn } from "@tanstack/react-start";

export const loadComplianceYearEndData = createServerFn({ method: "GET" }).handler(
  async () => {
    const { buildComplianceYearEndPageData } = await import(
      "@/start/server/route-data/compliance"
    );
    return (await buildComplianceYearEndPageData()) as any;
  },
);

export const Route = createAppFileRoute("/compliance/year-end")({
  loader: () => loadComplianceYearEndData(),
  head: () => ({
    meta: [{ title: "Year-end | Tamias" }],
  }),
});
