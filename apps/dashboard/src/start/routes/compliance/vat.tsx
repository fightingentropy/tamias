import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { AppLayoutShell } from "@/start/components/app-layout-shell";
import { VatDashboard } from "@/components/compliance/vat-dashboard";

const loadComplianceVatData = createServerFn({ method: "GET" }).handler(
  async () => {
    const { buildComplianceVatPageData } = await import(
      "@/start/server/route-data"
    );
    return (await buildComplianceVatPageData()) as any;
  },
);

export const Route = createFileRoute("/compliance/vat")({
  loader: () => loadComplianceVatData(),
  head: () => ({
    meta: [{ title: "VAT Filing | Tamias" }],
  }),
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
