import { createFileRoute } from "@tanstack/react-router"
import { createAppFileRoute } from "@/start/route-hosts";
import { createServerFn } from "@tanstack/react-start";

export const loadComplianceVatData = createServerFn({ method: "GET" }).handler(
  async () => {
    const { buildComplianceVatPageData } = await import(
      "@/start/server/route-data/compliance"
    );
    return (await buildComplianceVatPageData()) as any;
  },
);

export const Route = createAppFileRoute("/compliance/vat")({
  loader: () => loadComplianceVatData(),
  head: () => ({
    meta: [{ title: "VAT Filing | Tamias" }],
  }),
});
