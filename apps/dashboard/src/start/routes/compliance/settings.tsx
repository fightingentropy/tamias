import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { AppLayoutShell } from "@/start/components/app-layout-shell";
import { ComplianceSettingsForm } from "@/components/compliance/compliance-settings-form";

const loadComplianceSettingsData = createServerFn({ method: "GET" }).handler(
  async () => {
    const { buildComplianceSettingsPageData } = await import(
      "@/start/server/route-data"
    );
    return (await buildComplianceSettingsPageData()) as any;
  },
);

export const Route = createFileRoute("/compliance/settings")({
  loader: () => loadComplianceSettingsData(),
  head: () => ({
    meta: [{ title: "Compliance Settings | Tamias" }],
  }),
  component: ComplianceSettingsPage,
});

function ComplianceSettingsPage() {
  const loaderData = Route.useLoaderData() as Awaited<
    ReturnType<typeof loadComplianceSettingsData>
  >;

  return (
    <AppLayoutShell
      dehydratedState={loaderData.dehydratedState}
      user={loaderData.user}
    >
      <ComplianceSettingsForm />
    </AppLayoutShell>
  );
}
