import { describe, expect, test } from "bun:test";
import { buildPayrollLiabilityTotals, parsePayrollCsv } from "./index";

describe("payroll helpers", () => {
  test("parses payroll CSV rows into balanced journal lines", () => {
    const lines = parsePayrollCsv(`accountCode,debit,credit,description
6100,2500,0,Gross pay
2210,0,650,PAYE and NIC liability
2000,0,1850,Net pay payable`);

    expect(lines).toHaveLength(3);
    expect(lines[0]?.accountCode).toBe("6100");
    expect(lines[1]?.credit).toBe(650);
  });

  test("derives payroll liability totals from journal lines", () => {
    const totals = buildPayrollLiabilityTotals([
      {
        accountCode: "6100",
        debit: 2500,
        credit: 0,
      },
      {
        accountCode: "6110",
        debit: 120,
        credit: 0,
      },
      {
        accountCode: "2210",
        debit: 0,
        credit: 650,
      },
      {
        accountCode: "2000",
        debit: 0,
        credit: 1970,
      },
    ]);

    expect(totals.grossPay).toBe(2500);
    expect(totals.employerTaxes).toBe(120);
    expect(totals.payeLiability).toBe(650);
  });
});
