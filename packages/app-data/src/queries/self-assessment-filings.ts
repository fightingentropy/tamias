import {
  buildHmrcSaEnvelope,
  buildSelfAssessmentBody,
  HmrcSelfAssessmentProvider,
  SelfAssessmentFilingError,
  type HmrcSaEnvironment,
  type HmrcSaReceipt,
  type SelfAssessmentIdentity,
  type SimpleSelfAssessmentCalculation,
} from "@tamias/compliance";
import { requireCloudflareD1Database, type Database } from "../client";
import { getSelfAssessmentReport, SelfAssessmentConflict } from "./self-assessment";

type Context = { teamId: string; taxYear: number; userId: string };
type SubmissionRow = {
  id: string;
  environment: HmrcSaEnvironment;
  status: "prepared" | "pending" | HmrcSaReceipt["status"];
  request_fingerprint: string;
  body_xml: string;
  review_json: string;
  ir_mark: string;
  ir_mark_display: string;
  correlation_id: string | null;
  receipt_json: string | null;
  receipt_xml: string | null;
  response_endpoint: string | null;
  next_poll_at: string | null;
  created_at: string;
  updated_at: string;
  submitted_by: string;
};
export function selfAssessmentConnection(teamId: string) {
  const environment: HmrcSaEnvironment =
    process.env.HMRC_SA_ENVIRONMENT === "production" ? "production" : "test";
  const blockers: string[] = [];
  if (!process.env.HMRC_SA_VENDOR_ID?.trim()) {
    blockers.push(
      process.env.HMRC_CT_VENDOR_ID?.trim()
        ? "An HMRC vendor ID is present in Corporation Tax settings. The Self Assessment XML connection still needs to be configured."
        : "HMRC software vendor registration is not configured.",
    );
  }
  if (
    environment === "test" &&
    (!process.env.HMRC_SA_TEST_SENDER_ID || !process.env.HMRC_SA_TEST_PASSWORD)
  ) {
    blockers.push(
      process.env.HMRC_VAT_CLIENT_ID && process.env.HMRC_VAT_CLIENT_SECRET
        ? "HMRC OAuth settings are present. The 2025/26 annual return needs separate Self Assessment XML test credentials."
        : "HMRC Self Assessment XML test credentials are not configured.",
    );
  }
  if (environment === "production") {
    const liveTeams = (process.env.HMRC_SA_LIVE_TEAM_IDS ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    if (!liveTeams.includes(teamId))
      blockers.push("Live Self Assessment filing is not enabled for this workspace.");
    // Personal SA has its own interlock; enabling it must not enable CT, VAT or other filings.
    if (
      process.env.TAMIAS_ENVIRONMENT !== "production" ||
      process.env.HMRC_SA_LIVE_FILING_ENABLED !== "true" ||
      process.env.HMRC_SA_LIVE_FILING_CONFIRMATION !== "ENABLE_LIVE_SELF_ASSESSMENT"
    ) {
      blockers.push("Live Self Assessment filing is not enabled.");
    }
  }
  return { environment, ready: blockers.length === 0, blockers, supportedTaxYear: 2025 };
}
export async function requireSelfAssessmentOwner(
  db: Database,
  args: Pick<Context, "teamId" | "userId">,
) {
  const owner = await requireCloudflareD1Database(db)
    .prepare("select role from team_memberships where team_id = ? and user_id = ?")
    .bind(args.teamId, args.userId)
    .first<{ role: string }>();
  if (owner?.role !== "owner")
    throw new SelfAssessmentFilingError(
      "Only the workspace owner can access personal tax submissions.",
    );
}
function publicSubmission(row: SubmissionRow) {
  const review = JSON.parse(row.review_json) as {
    identity: SelfAssessmentIdentity;
    calculation: SimpleSelfAssessmentCalculation;
  };
  return {
    id: row.id,
    environment: row.environment,
    status: row.status,
    fingerprint: row.request_fingerprint,
    irMark: row.ir_mark_display,
    correlationId: row.correlation_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    nextPollAt: row.next_poll_at,
    receipt: row.receipt_json
      ? (JSON.parse(row.receipt_json) as Omit<HmrcSaReceipt, "rawXml">)
      : null,
    ...review,
  };
}
async function getRow(db: Database, args: Context & { id: string }) {
  await requireSelfAssessmentOwner(db, args);
  const row = await requireCloudflareD1Database(db)
    .prepare(
      "select * from self_assessment_submissions where id = ? and team_id = ? and tax_year = ?",
    )
    .bind(args.id, args.teamId, args.taxYear)
    .first<SubmissionRow>();
  if (!row)
    throw new SelfAssessmentFilingError("This tax submission is not available in this workspace.");
  return row;
}
export async function listSelfAssessmentFilings(db: Database, args: Context) {
  await requireSelfAssessmentOwner(db, args);
  const rows = await requireCloudflareD1Database(db)
    .prepare(
      "select * from self_assessment_submissions where team_id = ? and tax_year = ? order by created_at desc limit 100",
    )
    .bind(args.teamId, args.taxYear)
    .all<SubmissionRow>();
  return {
    connection: selfAssessmentConnection(args.teamId),
    data: (rows.results ?? []).map(publicSubmission),
  };
}
export async function prepareSelfAssessment(
  db: Database,
  args: Context & { fingerprint: string; identity: SelfAssessmentIdentity },
) {
  await requireSelfAssessmentOwner(db, args);
  const report = await getSelfAssessmentReport(db, args);
  if (report.fingerprint !== args.fingerprint)
    throw new SelfAssessmentConflict(
      "Your tax records changed. Refresh and review them before preparing a return.",
    );
  const prepared = buildSelfAssessmentBody(report, args.identity);
  const id = crypto.randomUUID(),
    now = new Date().toISOString();
  await requireCloudflareD1Database(db)
    .prepare(
      `insert into self_assessment_submissions
    (id, team_id, tax_year, environment, status, request_fingerprint, body_xml, review_json, ir_mark, ir_mark_display, created_at, updated_at, submitted_by)
    values (?, ?, ?, ?, 'prepared', ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      args.teamId,
      args.taxYear,
      selfAssessmentConnection(args.teamId).environment,
      report.fingerprint,
      prepared.bodyXml,
      JSON.stringify({ identity: args.identity, calculation: prepared.calculation }),
      prepared.irMark,
      prepared.irMarkDisplay,
      now,
      now,
      args.userId,
    )
    .run();
  return publicSubmission(await getRow(db, { ...args, id }));
}
async function saveReceipt(db: Database, row: SubmissionRow, receipt: HmrcSaReceipt) {
  const { rawXml, ...summary } = receipt;
  const now = new Date();
  const nextPoll =
    receipt.status === "acknowledged"
      ? new Date(now.getTime() + receipt.pollInterval * 1000).toISOString()
      : null;
  await requireCloudflareD1Database(db)
    .prepare(
      `update self_assessment_submissions set status = ?, correlation_id = coalesce(?, correlation_id),
    receipt_json = ?, receipt_xml = ?, response_endpoint = coalesce(?, response_endpoint), next_poll_at = ?, updated_at = ?
    where id = ? and status in ('pending', 'acknowledged', 'unknown')`,
    )
    .bind(
      receipt.status,
      receipt.correlationId,
      JSON.stringify(summary),
      rawXml,
      receipt.responseEndpoint,
      nextPoll,
      now.toISOString(),
      row.id,
    )
    .run();
}
export async function submitSelfAssessment(
  db: Database,
  args: Context & {
    id: string;
    declarationAccepted: true;
    confirmedIrMark: string;
    senderId?: string;
    password?: string;
  },
  provider?: HmrcSelfAssessmentProvider,
) {
  const row = await getRow(db, args);
  // Retrying the same request returns its saved state, never sends it twice.
  if (row.status !== "prepared") return publicSubmission(row);
  if (args.declarationAccepted !== true || args.confirmedIrMark !== row.ir_mark_display)
    throw new SelfAssessmentFilingError("Review and confirm this exact return before submitting.");
  const connection = selfAssessmentConnection(args.teamId);
  if (!connection.ready) throw new SelfAssessmentFilingError(connection.blockers.join(" "));
  if (connection.environment !== row.environment)
    throw new SelfAssessmentFilingError(
      "The HMRC connection changed. Prepare and review a new return.",
    );
  const senderId = row.environment === "test" ? process.env.HMRC_SA_TEST_SENDER_ID : args.senderId;
  const password = row.environment === "test" ? process.env.HMRC_SA_TEST_PASSWORD : args.password;
  if (!senderId || !password)
    throw new SelfAssessmentFilingError("Enter your Government Gateway details to submit.");
  const report = await getSelfAssessmentReport(db, args);
  if (report.profile.filedElsewhere)
    throw new SelfAssessmentFilingError("This return is already marked as filed outside Tamias.");
  if (report.fingerprint !== row.request_fingerprint)
    throw new SelfAssessmentConflict(
      "Your tax records changed after this return was prepared. Prepare a new return.",
    );
  const { identity } = JSON.parse(row.review_json) as { identity: SelfAssessmentIdentity };
  const xml = buildHmrcSaEnvelope({
    bodyXml: row.body_xml,
    utr: identity.utr,
    senderId,
    password,
    vendorId: process.env.HMRC_SA_VENDOR_ID!,
    environment: row.environment,
  });
  try {
    const claimed = await requireCloudflareD1Database(db)
      .prepare(
        "update self_assessment_submissions set status = 'pending', updated_at = ? where id = ? and status = 'prepared' returning id",
      )
      .bind(new Date().toISOString(), row.id)
      .all<{ id: string }>();
    if (!claimed.results?.length) return publicSubmission(await getRow(db, args));
  } catch {
    throw new SelfAssessmentConflict(
      "A live return for this tax year already exists or needs reconciliation. Check submission history before trying again.",
    );
  }
  const hmrc = provider ?? new HmrcSelfAssessmentProvider(row.environment);
  try {
    const receipt = await hmrc.submit(xml, row.ir_mark);
    await saveReceipt(db, row, receipt);
    if (receipt.status === "accepted" || receipt.status === "rejected") {
      if (receipt.correlationId)
        await hmrc
          .acknowledgeReceipt({
            correlationId: receipt.correlationId,
            responseEndpoint: receipt.responseEndpoint,
          })
          .catch(() => undefined);
    }
  } catch {
    // No credentials, request XML or exception body is logged or persisted. An unknown result is not retryable.
    await requireCloudflareD1Database(db)
      .prepare(
        "update self_assessment_submissions set status = 'unknown', updated_at = ? where id = ? and status = 'pending'",
      )
      .bind(new Date().toISOString(), row.id)
      .run();
  }
  return publicSubmission(await getRow(db, args));
}
export async function pollSelfAssessment(
  db: Database,
  args: Context & { id: string },
  provider?: HmrcSelfAssessmentProvider,
) {
  const row = await getRow(db, args);
  if (!["acknowledged", "unknown"].includes(row.status) || !row.correlation_id)
    return publicSubmission(row);
  const now = new Date();
  if (row.next_poll_at && row.next_poll_at > now.toISOString()) return publicSubmission(row);
  // Claim a poll slot to respect HMRC's minimum interval across multiple devices.
  const claimed = await requireCloudflareD1Database(db)
    .prepare(
      `update self_assessment_submissions set next_poll_at = ?
    where id = ? and status in ('acknowledged', 'unknown') and (next_poll_at is null or next_poll_at <= ?) returning id`,
    )
    .bind(new Date(now.getTime() + 30000).toISOString(), row.id, now.toISOString())
    .all<{ id: string }>();
  if (!claimed.results?.length) return publicSubmission(await getRow(db, args));
  const hmrc = provider ?? new HmrcSelfAssessmentProvider(row.environment);
  try {
    const receipt = await hmrc.poll({
      correlationId: row.correlation_id,
      irMark: row.ir_mark,
      responseEndpoint: row.response_endpoint,
    });
    await saveReceipt(db, row, receipt);
    if (["accepted", "rejected"].includes(receipt.status)) {
      await hmrc
        .acknowledgeReceipt({
          correlationId: row.correlation_id,
          responseEndpoint: receipt.responseEndpoint ?? row.response_endpoint,
        })
        .catch(() => undefined);
    }
  } catch {
    throw new SelfAssessmentFilingError(
      "HMRC status could not be refreshed. Your saved submission has not been sent again.",
    );
  }
  return publicSubmission(await getRow(db, args));
}
export async function selfAssessmentEvidence(db: Database, args: Context & { id: string }) {
  const row = await getRow(db, args);
  return {
    submission: publicSubmission(row),
    returnXml: row.body_xml,
    receiptXml: row.receipt_xml,
  };
}
