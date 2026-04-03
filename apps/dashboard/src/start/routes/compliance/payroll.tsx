import { createFileRoute } from "@tanstack/react-router"
import { createAppFileRoute } from "@/start/route-hosts";
import { createServerFn } from "@tanstack/react-start";

export const loadCompliancePayrollData = createServerFn({ method: "GET" }).handler(
  async () => {
    const { buildCompliancePayrollPageData } = await import(
      "@/start/server/route-data/compliance"
    );
    return (await buildCompliancePayrollPageData()) as any;
  },
);

export const Route = createAppFileRoute("/compliance/payroll")({
  loader: () => loadCompliancePayrollData(),
  head: () => ({
    meta: [{ title: "Payroll | Tamias" }],
  }),
});
