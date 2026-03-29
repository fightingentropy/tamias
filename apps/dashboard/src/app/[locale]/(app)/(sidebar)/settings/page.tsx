import type { Metadata } from "next";
import { BaseCurrency } from "@/components/base-currency/base-currency";
import { CompanyCountry } from "@/components/company-country";
import { CompanyEmail } from "@/components/company-email";
import { CompanyFiscalYear } from "@/components/company-fiscal-year";
import { CompanyLogo } from "@/components/company-logo";
import { CompanyName } from "@/components/company-name";
import { DeleteTeam } from "@/components/delete-team";
import { TeamIdSection } from "@/components/team-id-section";

export const metadata: Metadata = {
  title: "Team Settings | Tamias",
};

export default function Account() {
  return (
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
  );
}
