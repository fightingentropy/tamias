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
