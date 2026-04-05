import {
  isUkComplianceVisible,
  type HmrcCtEnvironment,
} from "@tamias/compliance";
import type { FilingProfileRecord } from "../../../convex";
import type { HmrcCtRuntimeStatus, TeamContext } from "./types";

export function buildEmptyYearEndDashboard(args: {
  team: TeamContext;
  profile: FilingProfileRecord | null;
}) {
  return {
    enabled: isUkComplianceVisible({
      countryCode: args.team.countryCode,
      profileEnabled: args.profile?.enabled,
    }),
    team: args.team,
    profile: args.profile,
    period: null,
    pack: null,
    ctRuntime: getHmrcCtRuntimeStatus(args.profile),
    manualJournalCount: 0,
    corporationTaxAdjustmentCount: 0,
    latestExportedAt: null,
  };
}

export function getHmrcCtEnvironment(): HmrcCtEnvironment {
  return process.env.HMRC_CT_ENVIRONMENT === "production"
    ? "production"
    : "test";
}

export function getHmrcCtRuntimeStatus(
  profile?: Pick<FilingProfileRecord, "utr"> | null,
): HmrcCtRuntimeStatus {
  const environment = getHmrcCtEnvironment();
  const configured = Boolean(
    process.env.HMRC_CT_SENDER_ID &&
      process.env.HMRC_CT_SENDER_PASSWORD &&
      process.env.HMRC_CT_VENDOR_ID,
  );
  const testReference = process.env.HMRC_CT_TEST_UTR?.trim() || null;
  const filingProfileReference = profile?.utr?.trim() || null;

  if (environment === "test" && testReference) {
    return {
      environment,
      configured,
      submissionReference: testReference,
      submissionReferenceSource: "hmrc_test_utr",
    };
  }

  if (filingProfileReference) {
    return {
      environment,
      configured,
      submissionReference: filingProfileReference,
      submissionReferenceSource: "filing_profile_utr",
    };
  }

  return {
    environment,
    configured,
    submissionReference: null,
    submissionReferenceSource: "missing",
  };
}

export function assertUkComplianceEnabled(
  team: TeamContext,
  profile?: { enabled: boolean } | null,
) {
  const visible = isUkComplianceVisible({
    countryCode: team.countryCode,
    profileEnabled: profile?.enabled,
  });

  if (!visible) {
    throw new Error("UK compliance is not enabled for this team");
  }
}
