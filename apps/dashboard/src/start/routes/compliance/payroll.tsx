import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { AppLayoutShell } from "@/start/components/app-layout-shell";
import { PayrollDashboard } from "@/components/compliance/payroll-dashboard";

const loadCompliancePayrollData = createServerFn({ method: "GET" }).handler(
  async () => {
    const { buildCompliancePayrollPageData } = await import(
      "@/start/server/route-data"
    );
    return (await buildCompliancePayrollPageData()) as any;
  },
);

export const Route = createFileRoute("/compliance/payroll")({
  loader: () => loadCompliancePayrollData(),
  head: () => ({
    meta: [{ title: "Payroll | Tamias" }],
  }),
  component: CompliancePayrollPage,
});

function CompliancePayrollPage() {
  const loaderData = Route.useLoaderData() as Awaited<
    ReturnType<typeof loadCompliancePayrollData>
  >;

  return (
    <AppLayoutShell
      dehydratedState={loaderData.dehydratedState}
      user={loaderData.user}
    >
      <PayrollDashboard />
    </AppLayoutShell>
  );
}
