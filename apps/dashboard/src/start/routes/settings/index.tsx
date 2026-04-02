import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { AppLayoutShell } from "@/start/components/app-layout-shell";
import { BaseCurrency } from "@/components/base-currency/base-currency";
import { CompanyCountry } from "@/components/company-country";
import { CompanyEmail } from "@/components/company-email";
import { CompanyFiscalYear } from "@/components/company-fiscal-year";
import { CompanyLogo } from "@/components/company-logo";
import { CompanyName } from "@/components/company-name";
import { DeleteTeam } from "@/components/delete-team";
import { TeamIdSection } from "@/components/team-id-section";

const loadSettingsData = createServerFn({ method: "GET" }).handler(
  async () => {
    const { buildSettingsPageData } = await import("@/start/server/route-data");
    return (await buildSettingsPageData()) as any;
  },
);

export const Route = createFileRoute("/settings/")({
  loader: () => loadSettingsData(),
  head: () => ({
    meta: [{ title: "Team Settings | Tamias" }],
  }),
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
