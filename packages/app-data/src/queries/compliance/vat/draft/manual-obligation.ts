import { endOfQuarter, format, startOfQuarter } from "date-fns";
import type { ComplianceObligationRecord } from "../../../../convex";

export function buildManualObligation(
  teamId: string,
  filingProfileId: string,
): ComplianceObligationRecord {
  const quarterStart = startOfQuarter(new Date());
  const quarterEnd = endOfQuarter(new Date());
  const periodKey = `${quarterStart.getFullYear()}-Q${Math.floor(quarterStart.getMonth() / 3) + 1}`;
  const generatedAt = new Date().toISOString();

  return {
    id: `manual-${periodKey}`,
    createdAt: generatedAt,
    updatedAt: generatedAt,
    teamId,
    filingProfileId,
    provider: "hmrc-vat",
    obligationType: "vat",
    periodKey,
    periodStart: format(quarterStart, "yyyy-MM-dd"),
    periodEnd: format(quarterEnd, "yyyy-MM-dd"),
    dueDate: format(quarterEnd, "yyyy-MM-dd"),
    status: "open",
    externalId: null,
    raw: null,
  };
}
