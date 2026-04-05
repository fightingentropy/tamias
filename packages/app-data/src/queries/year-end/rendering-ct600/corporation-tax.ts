import { parseISO } from "date-fns";
import { SMALL_PROFITS_RATE_START } from "../constants";
import type { Ct600Draft } from "../types";
import { formatMoney, inclusiveDayCount } from "./shared";

function getCorporationTaxFinancialYears(draft: Ct600Draft) {
  if (draft.financialYearBreakdown.length > 0) {
    return draft.financialYearBreakdown;
  }

  return [
    {
      financialYear: draft.financialYear,
      periodStart: draft.periodStart,
      periodEnd: draft.periodEnd,
      daysInSegment: inclusiveDayCount(
        parseISO(draft.periodStart),
        parseISO(draft.periodEnd),
      ),
      associatedCompanies: draft.associatedCompaniesThisPeriod,
      chargeableProfits: draft.chargeableProfits,
      augmentedProfits: draft.augmentedProfits,
      lowerLimit: null,
      upperLimit: null,
      taxRate: draft.taxRate,
      grossCorporationTax: draft.corporationTax,
      marginalRelief: draft.marginalRelief,
      netCorporationTax: draft.netCorporationTaxChargeable,
      chargeType: "main_rate" as const,
    },
  ];
}

function renderAssociatedCompaniesXml(draft: Ct600Draft) {
  const periodUsesSmallProfitsRules =
    parseISO(draft.periodEnd).getTime() >=
    parseISO(SMALL_PROFITS_RATE_START).getTime();

  if (!periodUsesSmallProfitsRules) {
    return "";
  }

  return `<AssociatedCompanies>${
    draft.associatedCompaniesMode === "financial_years"
      ? `<AssociatedCompaniesFinancialYears><FirstYear>${
          draft.associatedCompaniesFirstYear ?? 0
        }</FirstYear><SecondYear>${
          draft.associatedCompaniesSecondYear ?? 0
        }</SecondYear></AssociatedCompaniesFinancialYears>`
      : `<ThisPeriod>${draft.associatedCompaniesThisPeriod ?? 0}</ThisPeriod>`
  }${
    draft.startingOrSmallCompaniesRate
      ? "<StartingOrSmallCompaniesRate>yes</StartingOrSmallCompaniesRate>"
      : ""
  }</AssociatedCompanies>`;
}

function renderFinancialYearChargeXml(draft: Ct600Draft) {
  return getCorporationTaxFinancialYears(draft)
    .map((financialYear, index) => {
      const elementName = index === 0 ? "FinancialYearOne" : "FinancialYearTwo";

      return `<${elementName}><Year>${
        financialYear.financialYear
      }</Year><Details><Profit>${formatMoney(
        financialYear.chargeableProfits,
      )}</Profit><TaxRate>${formatMoney(
        financialYear.taxRate,
      )}</TaxRate><Tax>${formatMoney(
        financialYear.grossCorporationTax,
      )}</Tax></Details></${elementName}>`;
    })
    .join("");
}

export function renderCorporationTaxChargeableXml(draft: Ct600Draft) {
  return `${renderAssociatedCompaniesXml(draft)}${renderFinancialYearChargeXml(
    draft,
  )}`;
}
