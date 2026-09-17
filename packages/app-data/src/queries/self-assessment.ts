import { createHash } from "node:crypto";
import {
  buildSelfAssessmentReport,
  CisPaymentSchema,
  SelfAssessmentProfileSchema,
  TaxReviewBatchSchema,
  taxYearDates,
  type SelfAssessmentProfile,
  type TaxReview,
  type TaxSourceTransaction,
} from "@tamias/compliance";
import { requireCloudflareD1Database, type Database } from "../client";

type SourceRow = {
  id: string;
  name: string;
  date: string;
  amount: number;
  currency: string;
  base_amount: number | null;
  base_currency: string | null;
  status: string;
  internal: number;
  has_attachment: number;
  updated_at: string;
  category_slug: string | null;
};
type ReviewRow = {
  transaction_id: string;
  source_version: string;
  category: TaxReview["category"];
  business_percent: number;
  note: string;
  cis_json: string | null;
};

const relevantCis = `(json_extract(cis_json, '$.incomeTaxYear') = ?
  or json_extract(cis_json, '$.deductionTaxYear') = ?
  or exists (select 1 from json_each(json_extract(cis_json, '$.taxYearsUnderReview')) where value = ?))`;

export class SelfAssessmentConflict extends Error {}

export async function getSelfAssessmentReport(
  db: Database,
  args: { teamId: string; taxYear: number },
) {
  const d1 = requireCloudflareD1Database(db);
  const dates = taxYearDates(args.taxYear);
  // One D1 batch is a consistent snapshot. The extra row detects the bound: never report a partial year.
  const results = await d1.batch([
    d1
      .prepare(
        `select id, name, date, amount, currency, base_amount, base_currency, status, internal, has_attachment, updated_at, category_slug
      from transactions where team_id = ? and ((date >= ? and date < ?) or id in (
        select transaction_id from self_assessment_reviews where team_id = ? and ${relevantCis}
      )) order by date, id limit 20001`,
      )
      .bind(
        args.teamId,
        dates.start,
        dates.endExclusive,
        args.teamId,
        args.taxYear,
        args.taxYear,
        args.taxYear,
      ),
    d1
      .prepare(
        `select * from self_assessment_reviews where team_id = ? and (
          transaction_id in (select id from transactions where team_id = ? and date >= ? and date < ?)
          or transaction_id in (select transaction_id from self_assessment_reviews where team_id = ? and ${relevantCis})
        ) order by reviewed_at, transaction_id limit 20001`,
      )
      .bind(
        args.teamId,
        args.teamId,
        dates.start,
        dates.endExclusive,
        args.teamId,
        args.taxYear,
        args.taxYear,
        args.taxYear,
      ),
    d1
      .prepare(
        "select profile_json from self_assessment_profiles where team_id = ? and tax_year = ?",
      )
      .bind(args.teamId, args.taxYear),
  ]);
  const source = (results[0]?.results ?? []) as SourceRow[];
  if (source.length > 20000 || (results[1]?.results?.length ?? 0) > 20000)
    throw new SelfAssessmentConflict(
      "This tax year has more than 20,000 transactions. Use an accountant export before preparing a return here.",
    );
  const transactions: TaxSourceTransaction[] = source.map((t) => ({
    id: t.id,
    name: t.name,
    date: t.date,
    amount: t.amount,
    currency: t.currency,
    baseAmount: t.base_amount,
    baseCurrency: t.base_currency,
    status: t.status,
    internal: Boolean(t.internal),
    hasReceipt: Boolean(t.has_attachment),
    updatedAt: t.updated_at,
    isCis: t.category_slug === "cis-net-payments",
  }));
  const reviews: TaxReview[] = ((results[1]?.results ?? []) as ReviewRow[]).map((r) => ({
    transactionId: r.transaction_id,
    sourceVersion: r.source_version,
    category: r.category,
    businessPercent: r.business_percent,
    note: r.note,
    cis: r.cis_json ? CisPaymentSchema.parse(JSON.parse(r.cis_json)) : null,
  }));
  const profileRow = (results[2]?.results?.[0] ?? null) as { profile_json: string } | null;
  const profile = SelfAssessmentProfileSchema.parse(
    profileRow ? JSON.parse(profileRow.profile_json) : {},
  );
  const report = buildSelfAssessmentReport({
    taxYear: args.taxYear,
    transactions,
    reviews,
    profile,
  });
  // generatedAt is intentionally outside the review fingerprint.
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        calculationVersion: "2025-cis-v1",
        taxYear: args.taxYear,
        transactions,
        reviews,
        profile,
      }),
    )
    .digest("hex");
  return { ...report, fingerprint };
}

export async function saveSelfAssessmentProfile(
  db: Database,
  args: {
    teamId: string;
    taxYear: number;
    userId: string;
    profile: SelfAssessmentProfile;
  },
) {
  taxYearDates(args.taxYear);
  const profile = SelfAssessmentProfileSchema.parse(args.profile);
  await requireCloudflareD1Database(db)
    .prepare(
      `insert into self_assessment_profiles (team_id, tax_year, profile_json, updated_by, updated_at)
    values (?, ?, ?, ?, ?) on conflict (team_id, tax_year) do update set profile_json = excluded.profile_json,
    updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
    )
    .bind(args.teamId, args.taxYear, JSON.stringify(profile), args.userId, new Date().toISOString())
    .run();
  return getSelfAssessmentReport(db, args);
}

export async function reviewSelfAssessmentTransactions(
  db: Database,
  args: {
    teamId: string;
    taxYear: number;
    userId: string;
    reviews: TaxReview[];
  },
) {
  const dates = taxYearDates(args.taxYear);
  const { reviews } = TaxReviewBatchSchema.parse(args);
  if (new Set(reviews.map((r) => r.transactionId)).size !== reviews.length)
    throw new SelfAssessmentConflict("Choose each transaction only once.");
  const requested = reviews.map((r) => {
    let version: unknown;
    try {
      version = JSON.parse(r.sourceVersion);
    } catch {
      throw new SelfAssessmentConflict("Refresh these transactions before reviewing them.");
    }
    if (!Array.isArray(version) || version.length !== 8)
      throw new SelfAssessmentConflict("Refresh these transactions before reviewing them.");
    return { ...r, version };
  });
  // A single conditional statement validates every row and updates all or none, including on concurrent bank imports.
  const result = await requireCloudflareD1Database(db)
    .prepare(
      `
    with requested as (select value as r from json_each(?)),
    resolved as (
      select r, case when json_type(r, '$.cis') is null then old.cis_json
        else json_extract(r, '$.cis') end as cis
      from requested left join self_assessment_reviews old
        on old.team_id = ? and old.tax_year = ? and old.transaction_id = json_extract(r, '$.transactionId')
    ),
    verified as (
      select r, cis from resolved join transactions t on t.id = json_extract(r, '$.transactionId')
      where t.team_id = ? and t.date >= ? and t.date < ?
      and t.date is json_extract(r, '$.version[0]') and t.amount is json_extract(r, '$.version[1]')
      and t.currency is json_extract(r, '$.version[2]') and t.base_amount is json_extract(r, '$.version[3]')
      and t.base_currency is json_extract(r, '$.version[4]') and t.status is json_extract(r, '$.version[5]')
      and t.internal is json_extract(r, '$.version[6]') and t.updated_at is json_extract(r, '$.version[7]')
      and (cis is null or (
        json_extract(r, '$.category') = 'turnover' and json_extract(r, '$.businessPercent') = 100
        and upper(t.currency) = 'GBP' and t.amount > 0 and t.internal = 0
        and t.status not in ('pending', 'excluded', 'archived')
        and json_extract(cis, '$.grossPence') - json_extract(cis, '$.deductionPence') = round(t.amount * 100)
      ))
      and (t.category_slug is not 'cis-net-payments' or cis is not null or json_extract(r, '$.category') = 'excluded')
    )
    insert into self_assessment_reviews (team_id, tax_year, transaction_id, source_version, category, business_percent, note, reviewed_by, reviewed_at, cis_json)
    select ?, ?, json_extract(r, '$.transactionId'), json_extract(r, '$.sourceVersion'), json_extract(r, '$.category'),
      json_extract(r, '$.businessPercent'), json_extract(r, '$.note'), ?, ?, cis
    from verified where (select count(*) from verified) = ?
    on conflict (team_id, tax_year, transaction_id) do update set
      source_version = excluded.source_version, category = excluded.category, business_percent = excluded.business_percent,
      note = excluded.note, reviewed_by = excluded.reviewed_by, reviewed_at = excluded.reviewed_at, cis_json = excluded.cis_json
    returning transaction_id`,
    )
    .bind(
      JSON.stringify(requested),
      args.teamId,
      args.taxYear,
      args.teamId,
      dates.start,
      dates.endExclusive,
      args.teamId,
      args.taxYear,
      args.userId,
      new Date().toISOString(),
      reviews.length,
    )
    .all<{ transaction_id: string }>();
  if (result.results?.length !== reviews.length)
    throw new SelfAssessmentConflict(
      "One or more transactions changed, are unavailable, or have incompatible CIS figures. Refresh and check that CIS gross pay minus deductions matches the GBP bank credit; nothing was changed.",
    );
  return getSelfAssessmentReport(db, args);
}
