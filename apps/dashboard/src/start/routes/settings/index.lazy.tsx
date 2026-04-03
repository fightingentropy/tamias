import { createLazyFileRoute } from "@tanstack/react-router";
import { BaseCurrency } from "@/components/base-currency/base-currency";
import { CompanyCountry } from "@/components/company-country";
import { CompanyEmail } from "@/components/company-email";
import { CompanyFiscalYear } from "@/components/company-fiscal-year";
import { CompanyLogo } from "@/components/company-logo";
import { CompanyName } from "@/components/company-name";
import { DeleteTeam } from "@/components/delete-team";
import { TeamIdSection } from "@/components/team-id-section";
import { AppLayoutShell } from "@/start/components/app-layout-shell";
import { loadSettingsData } from "./index";

export const Route = createLazyFileRoute("/settings/")({
  component: SettingsPage,
});

function SettingsPage() {
  const loaderData = Route.useLoaderData() as Awaited<
    ReturnType<typeof loadSettingsData>
  >;

  return (
    <AppLayoutShell
      dehydratedState={loaderData.dehydratedState}
      user={loaderData.user}
    >
      <div className="space-y-12">
        <CompanyLogo />
        <CompanyName />
        <CompanyEmail />
        <CompanyCountry />
        <BaseCurrency />
        <CompanyFiscalYear />
        <TeamIdSection />
        <DeleteTeam />
      </div>
    </AppLayoutShell>
  );
}
