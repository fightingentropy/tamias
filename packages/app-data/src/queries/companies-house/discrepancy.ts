import {
  COMPANIES_HOUSE_PSC_DISCREPANCY_SCOPE,
  type CompaniesHousePscDiscrepancyMaterialType,
  type CompaniesHousePscDiscrepancyObligedEntityType,
  type CompaniesHousePscDiscrepancyType,
  type CompaniesHousePscType,
} from "@tamias/compliance";
import type { Database } from "../../client";
import {
  getRequiredCompanyNumber,
  requireCompaniesHouseProviderData,
  requireCompaniesHouseScope,
} from "./shared";
import { getFilingProfile } from "../compliance/shared";

export async function submitCompaniesHousePscDiscrepancyReport(
  db: Database,
  params: {
    teamId: string;
    companyNumber?: string;
    materialDiscrepancies: CompaniesHousePscDiscrepancyMaterialType[];
    obligedEntityType: CompaniesHousePscDiscrepancyObligedEntityType;
    obligedEntityOrganisationName: string;
    obligedEntityContactName: string;
    obligedEntityEmail: string;
    discrepancies: Array<{
      details: string;
      pscDateOfBirth?: string;
      pscDiscrepancyTypes: CompaniesHousePscDiscrepancyType[];
      pscName?: string;
      pscType: CompaniesHousePscType;
    }>;
    complete?: boolean;
  },
) {
  const [providerData, profile] = await Promise.all([
    requireCompaniesHouseProviderData(db, params.teamId),
    getFilingProfile(db, params.teamId),
  ]);
  const companyNumber = getRequiredCompanyNumber({
    explicitCompanyNumber: params.companyNumber,
    profileCompanyNumber: profile?.companyNumber,
  });

  requireCompaniesHouseScope(
    providerData.config.scope,
    COMPANIES_HOUSE_PSC_DISCREPANCY_SCOPE,
    "PSC discrepancy report",
  );

  const report = await providerData.provider.createPscDiscrepancyReport({
    accessToken: providerData.config.accessToken,
    companyNumber,
    materialDiscrepancies: params.materialDiscrepancies,
    obligedEntityType: params.obligedEntityType,
    obligedEntityOrganisationName: params.obligedEntityOrganisationName,
    obligedEntityContactName: params.obligedEntityContactName,
    obligedEntityEmail: params.obligedEntityEmail,
    status: "INCOMPLETE",
  });

  const reportId = report.links?.self?.split("/").pop();

  if (!reportId) {
    throw new Error("Companies House did not return a discrepancy report id for the new report");
  }

  const discrepancies = [];

  for (const discrepancy of params.discrepancies) {
    discrepancies.push(
      await providerData.provider.createPscDiscrepancy({
        reportId,
        accessToken: providerData.config.accessToken,
        details: discrepancy.details,
        pscDateOfBirth: discrepancy.pscDateOfBirth,
        pscDiscrepancyTypes: discrepancy.pscDiscrepancyTypes,
        pscName: discrepancy.pscName,
        pscType: discrepancy.pscType,
      }),
    );
  }

  const finalReport =
    params.complete === false
      ? report
      : await providerData.provider.updatePscDiscrepancyReport({
          reportId,
          accessToken: providerData.config.accessToken,
          companyNumber,
          materialDiscrepancies: params.materialDiscrepancies,
          obligedEntityType: params.obligedEntityType,
          obligedEntityOrganisationName: params.obligedEntityOrganisationName,
          obligedEntityContactName: params.obligedEntityContactName,
          obligedEntityEmail: params.obligedEntityEmail,
          status: "COMPLETE",
        });

  return {
    report,
    discrepancies,
    finalReport,
  };
}
