import type {
  CloseCompanyLoansScheduleRecord,
  CorporationTaxRateScheduleRecord,
  FilingProfileRecord,
  YearEndPackRecord,
} from "@tamias/app-data-convex";
import {
  renderAccountsAttachmentIxbrl,
  renderComputationsAttachmentIxbrl,
  renderCt600DraftXml,
  renderStatutoryAccountsDraftHtml,
} from "./rendering";
import { buildCt600Draft } from "./drafts-ct600";
import { buildStatutoryAccountsDraft } from "./drafts-statutory-accounts";
import type { CtSubmissionArtifacts, TeamContext } from "./types";

export function buildCtSubmissionArtifacts(args: {
  team: TeamContext;
  profile: FilingProfileRecord;
  pack: YearEndPackRecord;
  closeCompanyLoansSchedule?: CloseCompanyLoansScheduleRecord | null;
  corporationTaxRateSchedule?: CorporationTaxRateScheduleRecord | null;
}): CtSubmissionArtifacts {
  const statutoryAccountsDraft = buildStatutoryAccountsDraft({
    team: args.team,
    profile: args.profile,
    pack: args.pack,
    closeCompanyLoansSchedule: args.closeCompanyLoansSchedule,
    corporationTaxRateSchedule: args.corporationTaxRateSchedule,
  });
  const ct600Draft = buildCt600Draft({
    team: args.team,
    profile: args.profile,
    pack: args.pack,
    closeCompanyLoansSchedule: args.closeCompanyLoansSchedule,
    corporationTaxRateSchedule: args.corporationTaxRateSchedule,
  });
  const statutoryAccountsDraftHtml = renderStatutoryAccountsDraftHtml(
    statutoryAccountsDraft,
  );
  const statutoryAccountsDraftJson = JSON.stringify(
    statutoryAccountsDraft,
    null,
    2,
  );
  const accountsAttachmentIxbrl = renderAccountsAttachmentIxbrl(
    statutoryAccountsDraft,
  );
  const computationsAttachmentIxbrl =
    renderComputationsAttachmentIxbrl(ct600Draft);
  const ct600DraftXml = renderCt600DraftXml(ct600Draft, {
    accountsAttachmentXhtml: accountsAttachmentIxbrl,
    computationsAttachmentXhtml: computationsAttachmentIxbrl,
  });
  const ct600DraftJson = JSON.stringify(ct600Draft, null, 2);

  return {
    statutoryAccountsDraft,
    statutoryAccountsDraftHtml,
    statutoryAccountsDraftJson,
    ct600Draft,
    ct600DraftXml,
    ct600DraftJson,
    accountsAttachmentIxbrl,
    computationsAttachmentIxbrl,
  };
}
