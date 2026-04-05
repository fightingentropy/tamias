import { createHash } from "node:crypto";
import {
  allocateFilingSequenceInConvex,
} from "@tamias/app-data-convex";
import {
  COMPANIES_HOUSE_SUBMISSION_NUMBER_MAX,
  COMPANIES_HOUSE_SUBMISSION_NUMBER_WIDTH,
} from "../constants";
import type { CompaniesHouseXmlGatewayProvider } from "@tamias/compliance";

export function formatCompaniesHouseSubmissionNumber(sequence: number) {
  if (
    !Number.isSafeInteger(sequence) ||
    sequence < 1 ||
    sequence > COMPANIES_HOUSE_SUBMISSION_NUMBER_MAX
  ) {
    throw new Error(
      `Companies House submission number must be between 1 and ${COMPANIES_HOUSE_SUBMISSION_NUMBER_MAX}`,
    );
  }

  return sequence
    .toString()
    .padStart(COMPANIES_HOUSE_SUBMISSION_NUMBER_WIDTH, "0");
}

export function buildCompaniesHouseTransactionId(seed: string) {
  return createHash("sha1")
    .update(seed)
    .digest("hex")
    .toUpperCase()
    .slice(0, 16);
}

export function buildCompaniesHouseSubmissionSequenceScope(
  provider: CompaniesHouseXmlGatewayProvider,
) {
  return [
    "companies-house",
    "accounts",
    provider.environment,
    provider.presenterId,
    provider.packageReference,
  ].join(":");
}

export async function allocateCompaniesHouseSubmissionIdentifiers(
  provider: CompaniesHouseXmlGatewayProvider,
) {
  const sequence = await allocateFilingSequenceInConvex({
    scope: buildCompaniesHouseSubmissionSequenceScope(provider),
  });

  return {
    submissionNumber: formatCompaniesHouseSubmissionNumber(sequence),
    transactionId: buildCompaniesHouseTransactionId(
      [
        "submit",
        provider.environment,
        provider.presenterId,
        provider.packageReference,
        sequence,
        Date.now(),
        Math.random(),
      ].join(":"),
    ),
  };
}

export function buildCompaniesHousePreviewSubmissionIdentifiers(
  periodKey: string,
) {
  return {
    submissionNumber: "000000",
    transactionId: buildCompaniesHouseTransactionId(`preview:${periodKey}`),
  };
}
