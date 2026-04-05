import { createHash } from "node:crypto";
import { writeToString } from "@fast-csv/format";
import type {
  CloseCompanyLoansScheduleRecord,
  CorporationTaxRateScheduleRecord,
  FilingProfileRecord,
  YearEndPackRecord,
} from "../../convex";
import { buildCsvChecksum, buildZipBundle } from "./artifacts";
import { buildCtSubmissionArtifacts } from "./drafts";
import { parsePackArray } from "./formatting";
import { buildCompaniesHouseExportPreviewSubmissionXml } from "./export-preview";
import type {
  CorporationTaxSummary,
  TeamContext,
  TrialBalanceLine,
  WorkingPaperSection,
} from "./types";

type ArchiveFile = {
  name: string;
  data: Buffer;
  checksum: string;
};

export type YearEndExportArchiveManifest = {
  packId: string;
  periodKey: string;
  generatedAt: string;
  snapshotChecksum: string;
  files: Array<{
    name: string;
    checksum: string;
  }>;
};

export type YearEndExportArchive = {
  generatedAt: string;
  manifest: YearEndExportArchiveManifest;
  zipBuffer: Buffer;
};

function buildTextChecksum(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function buildTextFile(name: string, value: string) {
  return {
    name,
    data: Buffer.from(value, "utf8"),
    checksum: buildTextChecksum(value),
  } satisfies ArchiveFile;
}

function buildJsonFile(name: string, value: unknown) {
  return buildTextFile(name, JSON.stringify(value, null, 2));
}

export async function buildYearEndExportArchive(args: {
  team: TeamContext;
  profile: FilingProfileRecord;
  pack: YearEndPackRecord;
  closeCompanyLoansSchedule?: CloseCompanyLoansScheduleRecord | null;
  corporationTaxRateSchedule?: CorporationTaxRateScheduleRecord | null;
}) {
  const generatedAt = new Date().toISOString();
  const trialBalance = parsePackArray<TrialBalanceLine>(args.pack.trialBalance);
  const submissionArtifacts = buildCtSubmissionArtifacts({
    team: args.team,
    profile: args.profile,
    pack: args.pack,
    closeCompanyLoansSchedule: args.closeCompanyLoansSchedule,
    corporationTaxRateSchedule: args.corporationTaxRateSchedule,
  });
  const workingPapers = parsePackArray<WorkingPaperSection>(
    args.pack.workingPapers,
  );
  const corporationTax =
    (args.pack.corporationTax as CorporationTaxSummary | null) ?? null;
  const trialBalanceCsv = await writeToString(trialBalance, {
    headers: true,
  });
  const workingPapersCsv = await writeToString(
    workingPapers.flatMap((section) =>
      section.lines.map((line) => ({
        section: section.label,
        accountCode: line.accountCode,
        accountName: line.accountName,
        accountType: line.accountType,
        balance: line.balance,
      })),
    ),
    {
      headers: true,
    },
  );
  const ctSummaryCsv = await writeToString(
    [
      {
        label: "Accounting profit before tax",
        amount: corporationTax?.accountingProfitBeforeTax ?? 0,
      },
      {
        label: "Manual tax adjustments",
        amount: corporationTax?.manualAdjustmentsTotal ?? 0,
      },
      {
        label: "Taxable profit",
        amount: corporationTax?.taxableProfit ?? 0,
      },
      {
        label: "Estimated corporation tax due",
        amount: corporationTax?.estimatedCorporationTaxDue ?? 0,
      },
    ],
    {
      headers: true,
    },
  );
  const companiesHouseAccountsSubmissionXml =
    buildCompaniesHouseExportPreviewSubmissionXml({
      profile: args.profile,
      pack: args.pack,
      submissionArtifacts,
    });
  const files: ArchiveFile[] = [
    {
      name: "trial-balance.csv",
      data: Buffer.from(trialBalanceCsv, "utf8"),
      checksum: buildCsvChecksum(trialBalanceCsv),
    },
    {
      name: "working-papers.csv",
      data: Buffer.from(workingPapersCsv, "utf8"),
      checksum: buildCsvChecksum(workingPapersCsv),
    },
    {
      name: "ct-summary.csv",
      data: Buffer.from(ctSummaryCsv, "utf8"),
      checksum: buildCsvChecksum(ctSummaryCsv),
    },
    buildTextFile(
      "statutory-accounts-draft.html",
      submissionArtifacts.statutoryAccountsDraftHtml,
    ),
    buildTextFile(
      "statutory-accounts-draft.json",
      submissionArtifacts.statutoryAccountsDraftJson,
    ),
    buildTextFile("ct600-draft.xml", submissionArtifacts.ct600DraftXml),
    buildTextFile("ct600-draft.json", submissionArtifacts.ct600DraftJson),
    buildTextFile(
      "accounts-attachment.ixbrl.xhtml",
      submissionArtifacts.accountsAttachmentIxbrl,
    ),
    buildTextFile(
      "computations-attachment.ixbrl.xhtml",
      submissionArtifacts.computationsAttachmentIxbrl,
    ),
    ...(companiesHouseAccountsSubmissionXml
      ? [
          buildTextFile(
            "companies-house-accounts-submission.xml",
            companiesHouseAccountsSubmissionXml,
          ),
        ]
      : []),
    ...(args.closeCompanyLoansSchedule
      ? [
          buildJsonFile(
            "ct600a-close-company-loans.json",
            args.closeCompanyLoansSchedule,
          ),
        ]
      : []),
    ...(args.corporationTaxRateSchedule
      ? [
          buildJsonFile(
            "corporation-tax-rate-inputs.json",
            args.corporationTaxRateSchedule,
          ),
        ]
      : []),
  ];
  const manifest = {
    packId: args.pack.id,
    periodKey: args.pack.periodKey,
    generatedAt,
    snapshotChecksum: args.pack.snapshotChecksum,
    files: files.map((file) => ({
      name: file.name,
      checksum: file.checksum,
    })),
  } satisfies YearEndExportArchiveManifest;
  const zipBuffer = await buildZipBundle([
    ...files.map((file) => ({
      name: file.name,
      data: file.data,
    })),
    {
      name: "manifest.json",
      data: Buffer.from(JSON.stringify(manifest, null, 2), "utf8"),
    },
  ]);

  return {
    generatedAt,
    manifest,
    zipBuffer,
  } satisfies YearEndExportArchive;
}
