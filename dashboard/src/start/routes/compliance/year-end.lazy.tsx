import { createLazyFileRoute } from "@tanstack/react-router";
import { AppLayoutShell } from "@/start/components/app-layout-shell";
import { YearEndDashboardClient } from "@/components/compliance/year-end-dashboard-client";
import { loadComplianceYearEndData } from "./year-end";

export const Route = createLazyFileRoute("/compliance/year-end")({
  component: ComplianceYearEndPage,
});

function ComplianceYearEndPage() {
  const loaderData = Route.useLoaderData() as Awaited<ReturnType<typeof loadComplianceYearEndData>>;

  return (
    <AppLayoutShell dehydratedState={loaderData.dehydratedState} user={loaderData.user}>
      <YearEndDashboardClient />
    </AppLayoutShell>
  );
}
