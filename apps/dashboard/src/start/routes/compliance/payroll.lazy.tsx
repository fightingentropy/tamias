import { createLazyFileRoute } from "@tanstack/react-router";
import { AppLayoutShell } from "@/start/components/app-layout-shell";
import { PayrollDashboard } from "@/components/compliance/payroll-dashboard";
import { loadCompliancePayrollData } from "./payroll";

export const Route = createLazyFileRoute("/compliance/payroll")({
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
