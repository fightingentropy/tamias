import { addYears, format, subYears } from "date-fns";
import { HmrcRequestError } from "@tamias/compliance";
import type { FilingProfileRecord } from "../filings";
import type { Database } from "../../../client";
import { assertUkComplianceEnabled, getHmrcProvider } from "../shared";
import { getVatTeamAndProfile, type VatTeamContext } from "./context";
import { listVatObligationsFromD1, upsertVatObligationInD1 } from "./d1";
import type { ListVatObligationsParams } from "./types";

async function syncVatObligations(
  db: Database,
  params: ListVatObligationsParams & {
    team: VatTeamContext;
    profile: FilingProfileRecord;
  },
) {
  if (!params.profile.vrn || !params.fraudContext) {
    return [];
  }

  const providerData = await getHmrcProvider(db, params.teamId, params.profile);

  if (!providerData) {
    return [];
  }

  const from = format(subYears(new Date(), 1), "yyyy-MM-dd");
  const to = format(addYears(new Date(), 1), "yyyy-MM-dd");
  const obligations = await providerData.provider.getObligations({
    vrn: params.profile.vrn,
    from,
    to,
    accessToken: providerData.config.accessToken,
    fraudContext: params.fraudContext,
  });

  for (const obligation of obligations) {
    await upsertVatObligationInD1(db, {
      teamId: params.teamId,
      filingProfileId: params.profile.id,
      provider: "hmrc-vat",
      obligationType: "vat",
      periodKey: obligation.periodKey,
      periodStart: obligation.start,
      periodEnd: obligation.end,
      dueDate: obligation.due,
      status: obligation.status,
      externalId: obligation.periodKey,
      raw: obligation,
    });
  }

  return obligations;
}

export async function getVatObligationsWithSyncStatus(
  db: Database,
  params: ListVatObligationsParams,
) {
  const { team, profile } = await getVatTeamAndProfile(db, params.teamId);

  if (!profile) {
    return { obligations: [], syncError: null };
  }

  assertUkComplianceEnabled(team, profile);

  let syncError: string | null = null;
  try {
    await syncVatObligations(db, { ...params, team, profile });
  } catch (error) {
    syncError =
      error instanceof HmrcRequestError
        ? error.message
        : "HMRC obligations could not be refreshed. Check the connection or contact Tamias support.";
  }

  const obligations = await listVatObligationsFromD1(db, {
    teamId: params.teamId,
  });

  return {
    obligations: obligations.filter(
      (item) => item.provider === "hmrc-vat" && item.obligationType === "vat",
    ),
    syncError,
  };
}

export async function listVatObligations(db: Database, params: ListVatObligationsParams) {
  const result = await getVatObligationsWithSyncStatus(db, params);
  if (result.syncError) throw new Error(result.syncError);
  return result.obligations;
}
