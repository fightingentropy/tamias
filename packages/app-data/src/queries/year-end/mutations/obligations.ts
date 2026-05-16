import type { Database } from "../../../client";
import { listComplianceObligationRecords } from "../../compliance/filings";
import { getYearEndMutationContext } from "./common";

export async function listAnnualObligations(db: Database, params: { teamId: string }) {
  const context = await getYearEndMutationContext(db, params.teamId);
  const obligations = await listComplianceObligationRecords(db, {
    teamId: params.teamId,
  });

  return obligations.filter(
    (obligation) =>
      obligation.filingProfileId === context.profile.id &&
      (obligation.obligationType === "accounts" || obligation.obligationType === "corporation_tax"),
  );
}
