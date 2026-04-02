import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { AppLayoutShell } from "@/start/components/app-layout-shell";
import { ComplianceOverview } from "@/components/compliance/compliance-overview";

const loadComplianceData = createServerFn({ method: "GET" }).handler(
  async () => {
    const { buildCompliancePageData } = await import(
      "@/start/server/route-data"
    );
    return (await buildCompliancePageData()) as any;
  },
);

export const Route = createFileRoute("/compliance/")({
  loader: () => loadComplianceData(),
  head: () => ({
    meta: [{ title: "Compliance | Tamias" }],
  }),
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
