import type { LedgerAccountType } from "./types";

export type LedgerAccountSeed = {
  code: string;
  name: string;
  type: LedgerAccountType;
  taxCode?: string | null;
  system?: boolean;
};

export const UK_SYSTEM_LEDGER_ACCOUNTS: LedgerAccountSeed[] = [
  { code: "1000", name: "Business Bank", type: "asset", system: true },
  { code: "1100", name: "Accounts Receivable", type: "asset", system: true },
  { code: "2000", name: "Accounts Payable", type: "liability", system: true },
  {
    code: "2100",
    name: "Accrued Expenses",
    type: "liability",
    system: true,
  },
  {
    code: "1200",
    name: "VAT Input",
    type: "asset",
    taxCode: "UK_INPUT_20",
    system: true,
  },
  {
    code: "2200",
    name: "VAT Output",
    type: "liability",
    taxCode: "UK_OUTPUT_20",
    system: true,
  },
  {
    code: "2210",
    name: "PAYE and NIC Liability",
    type: "liability",
    system: true,
  },
  {
    code: "2300",
    name: "Corporation Tax Liability",
    type: "liability",
    system: true,
  },
  { code: "2400", name: "Debt", type: "liability", system: true },
  { code: "3000", name: "Share Capital", type: "equity", system: true },
  { code: "3100", name: "Retained Earnings", type: "equity", system: true },
  { code: "4000", name: "Sales", type: "income", system: true },
  { code: "4900", name: "Sales Returns", type: "income", system: true },
  { code: "5000", name: "Operating Expenses", type: "expense", system: true },
  { code: "6100", name: "Payroll Expense", type: "expense", system: true },
  {
    code: "6110",
    name: "Employer NIC Expense",
    type: "expense",
    system: true,
  },
];

export const UK_VAT_CODE_SET = [
  { code: "UK_STD_20", label: "UK Standard 20%", rate: 20, box: "box1" },
  { code: "UK_RED_5", label: "UK Reduced 5%", rate: 5, box: "box1" },
  { code: "UK_ZERO", label: "UK Zero-rated", rate: 0, box: "box6" },
  { code: "UK_INPUT_20", label: "UK Input 20%", rate: 20, box: "box4" },
  { code: "UK_EXEMPT", label: "UK Exempt", rate: 0, box: null },
] as const;
