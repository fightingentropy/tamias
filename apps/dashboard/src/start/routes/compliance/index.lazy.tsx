import { createLazyFileRoute } from "@tanstack/react-router";
import { ComplianceOverview } from "@/components/compliance/compliance-overview";
import { AppLayoutShell } from "@/start/components/app-layout-shell";
import { loadComplianceData } from "./index";

export const Route = createLazyFileRoute("/compliance/")({
  component: CompliancePage,
});

function CompliancePage() {
  const loaderData = Route.useLoaderData() as Awaited<
    ReturnType<typeof loadComplianceData>
  >;

  return (
    <AppLayoutShell
      dehydratedState={loaderData.dehydratedState}
      user={loaderData.user}
    >
      <ComplianceOverview />
    </AppLayoutShell>
  );
}
