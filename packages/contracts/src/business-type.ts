// These describe a workspace; they do not establish its legal or tax status.
export const BUSINESS_TYPES = [
  "sole_trader",
  "cis_subcontractor",
  "tradesperson",
  "freelancer",
  "limited_company",
  "partnership",
  "solo_founder",
  "small_team",
  "startup",
  "agency",
  "retail_hospitality",
  "ecommerce",
  "creator",
  "non_profit",
  "accountant",
  "other",
  "exploring",
] as const;

export type BusinessType = (typeof BUSINESS_TYPES)[number];

export const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  sole_trader: "Sole trader / Self-employed",
  cis_subcontractor: "CIS subcontractor",
  tradesperson: "Tradesperson / Contractor",
  freelancer: "Freelancer / Consultant",
  limited_company: "Limited company",
  partnership: "Partnership",
  solo_founder: "Solo founder",
  small_team: "2–10 person team",
  startup: "Startup (11–50)",
  agency: "Agency",
  retail_hospitality: "Retail / Hospitality",
  ecommerce: "E-commerce",
  creator: "Creator / Content",
  non_profit: "Non-profit",
  accountant: "Accountant / Bookkeeper",
  other: "Other business",
  exploring: "Just exploring",
};

export const BUSINESS_STRUCTURES = [
  "sole_trader",
  "limited_company",
  "partnership",
  "limited_liability_partnership",
  "other",
  "not_sure",
] as const;
export type BusinessStructure = (typeof BUSINESS_STRUCTURES)[number];
export const BUSINESS_STRUCTURE_LABELS: Record<BusinessStructure, string> = {
  sole_trader: "Sole trader",
  limited_company: "Limited company",
  partnership: "Partnership",
  limited_liability_partnership: "Limited liability partnership",
  other: "Other structure",
  not_sure: "Not sure yet",
};

// Existing category values remain valid for older clients and workspaces.
export const BUSINESS_CATEGORIES = BUSINESS_TYPES.filter(
  (value) =>
    !["sole_trader", "limited_company", "partnership", "cis_subcontractor"].includes(value),
);

export function getBusinessProfile(
  team?: {
    companyType?: string | null;
    businessStructure?: string | null;
    usesCis?: boolean | null;
  } | null,
) {
  const legacyStructure = ["sole_trader", "limited_company", "partnership"].includes(
    team?.companyType ?? "",
  )
    ? team?.companyType
    : null;
  const candidate = team?.businessStructure ?? legacyStructure;
  const structure = BUSINESS_STRUCTURES.includes(candidate as BusinessStructure)
    ? (candidate as BusinessStructure)
    : null;
  const usesCis =
    team?.usesCis !== undefined
      ? team.usesCis
      : team?.companyType === "cis_subcontractor"
        ? true
        : null;
  return {
    structure,
    usesCis,
    isSoleTrader: structure === "sole_trader",
    isLimitedCompany: structure === "limited_company",
    // A legacy CIS category never establishes the business's legal structure.
    showSelfAssessment:
      structure === "sole_trader" || ((!structure || structure === "not_sure") && usesCis === true),
  };
}
