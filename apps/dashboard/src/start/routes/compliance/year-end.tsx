import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { AppLayoutShell } from "@/start/components/app-layout-shell";
import { YearEndDashboardClient } from "@/components/compliance/year-end-dashboard-client";

const loadComplianceYearEndData = createServerFn({ method: "GET" }).handler(
  async () => {
    const { buildComplianceYearEndPageData } = await import(
      "@/start/server/route-data"
    );
    return (await buildComplianceYearEndPageData()) as any;
  },
);

export const Route = createFileRoute("/compliance/year-end")({
  loader: () => loadComplianceYearEndData(),
  head: () => ({
    meta: [{ title: "Year-end | Tamias" }],
  }),
  component: ComplianceYearEndPage,
});

function ComplianceYearEndPage() {
  const loaderData = Route.useLoaderData() as Awaited<
    ReturnType<typeof loadComplianceYearEndData>
  >;

  return (
    <AppLayoutShell
      dehydratedState={loaderData.dehydratedState}
      user={loaderData.user}
    >
      <YearEndDashboardClient />
    </AppLayoutShell>
  );
}
