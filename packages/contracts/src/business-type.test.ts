import { describe, expect, test } from "bun:test";
import { getBusinessProfile } from "./business-type";

describe("business structure and CIS", () => {
  test("CIS can coexist with either a sole trader or a limited company", () => {
    expect(
      getBusinessProfile({ businessStructure: "sole_trader", usesCis: true }).showSelfAssessment,
    ).toBe(true);
    const company = getBusinessProfile({ businessStructure: "limited_company", usesCis: true });
    expect(company.isLimitedCompany).toBe(true);
    expect(company.usesCis).toBe(true);
    expect(company.showSelfAssessment).toBe(false);
  });
  test("a legacy CIS category does not establish a legal structure", () => {
    const profile = getBusinessProfile({ companyType: "cis_subcontractor" });
    expect(profile.structure).toBeNull();
    expect(profile.isSoleTrader).toBe(false);
    expect(profile.usesCis).toBe(true);
    expect(profile.showSelfAssessment).toBe(true);
  });
  test("explicit preferences override legacy categories, including false", () => {
    expect(getBusinessProfile({ companyType: "cis_subcontractor", usesCis: false }).usesCis).toBe(
      false,
    );
    expect(
      getBusinessProfile({ companyType: "sole_trader", businessStructure: "limited_company" })
        .showSelfAssessment,
    ).toBe(false);
  });
  test("unknown and unrelated work categories stay unclassified", () => {
    expect(getBusinessProfile({ companyType: "tradesperson" }).structure).toBeNull();
    expect(getBusinessProfile({ companyType: "freelancer" }).usesCis).toBeNull();
    expect(getBusinessProfile(null).showSelfAssessment).toBe(false);
  });
});
