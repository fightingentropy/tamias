import { createLazyFileRoute } from "@tanstack/react-router";
import { AppLayoutShell } from "@/start/components/app-layout-shell";
import { ComplianceSettingsForm } from "@/components/compliance/compliance-settings-form";
import { loadComplianceSettingsData } from "./settings";

export const Route = createLazyFileRoute("/compliance/settings")({
  component: ComplianceSettingsPage,
});

function ComplianceSettingsPage() {
  const loaderData = Route.useLoaderData() as Awaited<
    ReturnType<typeof loadComplianceSettingsData>
  >;

  return (
    <AppLayoutShell dehydratedState={loaderData.dehydratedState} user={loaderData.user}>
      <ComplianceSettingsForm />
    </AppLayoutShell>
  );
}
