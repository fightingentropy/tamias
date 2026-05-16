import { addYears, format, subYears } from "date-fns";
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
  if (!params.profile.vrn) {
    return [];
  }

  let providerData: Awaited<ReturnType<typeof getHmrcProvider>> | null = null;

  try {
    providerData = await getHmrcProvider(db, params.teamId, params.profile);
  } catch {
    return [];
  }

  if (!providerData) {
    return [];
  }

  const from = format(subYears(new Date(), 1), "yyyy-MM-dd");
  const to = format(addYears(new Date(), 1), "yyyy-MM-dd");
  let obligations: Awaited<ReturnType<typeof providerData.provider.getObligations>> = [];

  try {
    obligations = await providerData.provider.getObligations({
      vrn: params.profile.vrn,
      from,
      to,
      accessToken: providerData.config.accessToken,
    });
  } catch {
    return [];
  }

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

export async function listVatObligations(db: Database, params: ListVatObligationsParams) {
  const { team, profile } = await getVatTeamAndProfile(db, params.teamId);

  if (!profile) {
    return [];
  }

  assertUkComplianceEnabled(team, profile);

  await syncVatObligations(db, { ...params, team, profile });

  const obligations = await listVatObligationsFromD1(db, {
    teamId: params.teamId,
  });

  return obligations.filter(
    (item) => item.provider === "hmrc-vat" && item.obligationType === "vat",
  );
}
