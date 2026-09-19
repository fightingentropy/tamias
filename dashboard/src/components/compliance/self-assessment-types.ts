import type {
  HmrcSaReceipt,
  SelfAssessmentIdentity,
  SimpleSelfAssessmentCalculation,
} from "@tamias/compliance";
import type { SelfAssessmentReport } from "@tamias/compliance/self-assessment";

export type TaxReport = SelfAssessmentReport & { fingerprint: string };
export type TaxRequest = <T>(
  path: string,
  body?: unknown,
  method?: "GET" | "PUT" | "POST",
) => Promise<T>;
export type TaxConnection = {
  environment: "test" | "production";
  ready: boolean;
  blockers: string[];
  supportedTaxYear: number;
};
export type TaxFiling = {
  id: string;
  environment: "test" | "production";
  status: "prepared" | "pending" | HmrcSaReceipt["status"];
  fingerprint: string;
  irMark: string;
  correlationId: string | null;
  createdAt: string;
  nextPollAt: string | null;
  receipt: Omit<HmrcSaReceipt, "rawXml"> | null;
  identity: SelfAssessmentIdentity;
  calculation: SimpleSelfAssessmentCalculation;
};
export type TaxFilingHistory = { data: TaxFiling[]; connection: TaxConnection };
export const taxMoney = (pence: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);
export const taxYearLabel = (year: number) => `${year}/${String(year + 1).slice(-2)}`;
export const taxSelectStyle = "h-10 w-full border bg-background px-3 text-sm";
export const filingStatusLabels: Record<TaxFiling["status"], string> = {
  prepared: "Prepared · not submitted",
  pending: "Submission in progress",
  acknowledged: "Received by HMRC · awaiting acceptance",
  accepted: "Accepted by HMRC",
  rejected: "Rejected by HMRC",
  unknown: "Submission outcome needs checking",
};

export function filingIsCurrent(filing: TaxFiling, report: TaxReport, connection: TaxConnection) {
  return filing.fingerprint === report.fingerprint && filing.environment === connection.environment;
}

export function downloadTaxEvidence(value: unknown, filename: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
