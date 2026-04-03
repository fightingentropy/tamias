import { createLazyFileRoute } from "@tanstack/react-router";
import { AppLayoutShell } from "@/start/components/app-layout-shell";
import { VatDashboard } from "@/components/compliance/vat-dashboard";
import { loadComplianceVatData } from "./vat";

export const Route = createLazyFileRoute("/compliance/vat")({
  component: ComplianceVatPage,
});

function ComplianceVatPage() {
  const loaderData = Route.useLoaderData() as Awaited<
    ReturnType<typeof loadComplianceVatData>
  >;

  return (
    <AppLayoutShell
      dehydratedState={loaderData.dehydratedState}
      user={loaderData.user}
    >
      <VatDashboard />
    </AppLayoutShell>
  );
}
