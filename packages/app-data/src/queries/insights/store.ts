import { requireCloudflareD1Database, type Database, type DatabaseOrTransaction } from "../../client";

export type InsightPeriodType = "weekly" | "monthly" | "quarterly" | "yearly";
export type InsightStatus = "pending" | "generating" | "completed" | "failed";

export type InsightRecord = {
  id: string;
  teamId: string;
  periodType: InsightPeriodType;
  periodStart: string;
  periodEnd: string;
  periodYear: number;
  periodNumber: number;
  status: InsightStatus;
  selectedMetrics: unknown;
  allMetrics: unknown;
  anomalies: unknown;
  expenseAnomalies: unknown;
  milestones: unknown;
  activity: unknown;
  currency: string;
  title: string | null;
  content: unknown;
  predictions: unknown;
  generatedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type InsightUserStatusRecord = {
  insightId: string;
  userId: string;
  readAt: string | null;
  dismissedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type InsightRecordRow = {
  id: string;
  team_id: string;
  period_type: InsightPeriodType;
  period_start: string;
  period_end: string;
  period_year: number;
  period_number: number;
  status: InsightStatus;
  selected_metrics_json: string | null;
  all_metrics_json: string | null;
  anomalies_json: string | null;
  expense_anomalies_json: string | null;
  milestones_json: string | null;
  activity_json: string | null;
  currency: string;
  title: string | null;
  content_json: string | null;
  predictions_json: string | null;
  generated_at: string | null;
  created_at: string;
  updated_at: string;
};

type InsightUserStatusRow = {
  user_id: string;
  insight_id: string;
  read_at: string | null;
  dismissed_at: string | null;
  created_at: string;
  updated_at: string;
};

function getInsightsD1(db: Database | DatabaseOrTransaction) {
  return requireCloudflareD1Database(db);
}

function parseJson(value: string | null) {
  return value === null ? null : JSON.parse(value);
}

function serializeJson(value: unknown) {
  return value === undefined || value === null ? null : JSON.stringify(value);
}

function toInsightRecord(row: InsightRecordRow): InsightRecord {
  return {
    id: row.id,
    teamId: row.team_id,
    periodType: row.period_type,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    periodYear: row.period_year,
    periodNumber: row.period_number,
    status: row.status,
    selectedMetrics: parseJson(row.selected_metrics_json),
    allMetrics: parseJson(row.all_metrics_json),
    anomalies: parseJson(row.anomalies_json),
    expenseAnomalies: parseJson(row.expense_anomalies_json),
    milestones: parseJson(row.milestones_json),
    activity: parseJson(row.activity_json),
    currency: row.currency,
    title: row.title,
    content: parseJson(row.content_json),
    predictions: parseJson(row.predictions_json),
    generatedAt: row.generated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toInsightUserStatus(row: InsightUserStatusRow): InsightUserStatusRecord {
  return {
    insightId: row.insight_id,
    userId: row.user_id,
    readAt: row.read_at,
    dismissedAt: row.dismissed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const insightRecordColumns = `id,
team_id,
period_type,
period_start,
period_end,
period_year,
period_number,
status,
selected_metrics_json,
all_metrics_json,
anomalies_json,
expense_anomalies_json,
milestones_json,
activity_json,
currency,
title,
content_json,
predictions_json,
generated_at,
created_at,
updated_at`;

export async function listInsightRecords(db: Database | DatabaseOrTransaction, args: { teamId: string }) {
  const { results = [] } = await getInsightsD1(db)
    .prepare(
      `select ${insightRecordColumns}
      from insight_records
      where team_id = ?
      order by period_year desc, period_number desc, created_at desc`,
    )
    .bind(args.teamId)
    .all<InsightRecordRow>();

  return results.map(toInsightRecord);
}

export async function getInsightRecordById(
  db: Database | DatabaseOrTransaction,
  args: { teamId: string; id: string },
) {
  const row = await getInsightsD1(db)
    .prepare(
      `select ${insightRecordColumns}
      from insight_records
      where team_id = ? and id = ?`,
    )
    .bind(args.teamId, args.id)
    .first<InsightRecordRow>();

  return row ? toInsightRecord(row) : null;
}

export async function createInsightRecord(
  db: Database | DatabaseOrTransaction,
  args: {
    teamId: string;
    periodType: InsightPeriodType;
    periodStart: string;
    periodEnd: string;
    periodYear: number;
    periodNumber: number;
    currency: string;
  },
) {
  const timestamp = new Date().toISOString();
  const id = crypto.randomUUID();

  const result = await getInsightsD1(db)
    .prepare(
      `insert into insight_records (
        id,
        team_id,
        period_type,
        period_start,
        period_end,
        period_year,
        period_number,
        status,
        currency,
        created_at,
        updated_at
      ) values (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
      on conflict(team_id, period_type, period_year, period_number) do nothing`,
    )
    .bind(
      id,
      args.teamId,
      args.periodType,
      args.periodStart,
      args.periodEnd,
      args.periodYear,
      args.periodNumber,
      args.currency,
      timestamp,
      timestamp,
    )
    .run();

  const insertMeta = result.meta as { changes?: number } | undefined;
  const didInsert = insertMeta?.changes === undefined ? true : insertMeta.changes > 0;

  if (!didInsert) {
    return null;
  }

  return getInsightRecordById(db, { teamId: args.teamId, id });
}

export async function updateInsightRecord(
  db: Database | DatabaseOrTransaction,
  args: {
    teamId: string;
    id: string;
    status?: InsightStatus;
    title?: string | null;
    selectedMetrics?: unknown;
    allMetrics?: unknown;
    anomalies?: unknown;
    expenseAnomalies?: unknown;
    milestones?: unknown;
    activity?: unknown;
    content?: unknown;
    predictions?: unknown;
    generatedAt?: string | null;
  },
) {
  const existing = await getInsightRecordById(db, { teamId: args.teamId, id: args.id });

  if (!existing) {
    return null;
  }

  const updates: string[] = [];
  const values: unknown[] = [];

  const setValue = (column: string, value: unknown) => {
    updates.push(`${column} = ?`);
    values.push(value);
  };

  if (args.status !== undefined) setValue("status", args.status);
  if (args.title !== undefined) setValue("title", args.title);
  if (args.selectedMetrics !== undefined) setValue("selected_metrics_json", serializeJson(args.selectedMetrics));
  if (args.allMetrics !== undefined) setValue("all_metrics_json", serializeJson(args.allMetrics));
  if (args.anomalies !== undefined) setValue("anomalies_json", serializeJson(args.anomalies));
  if (args.expenseAnomalies !== undefined) {
    setValue("expense_anomalies_json", serializeJson(args.expenseAnomalies));
  }
  if (args.milestones !== undefined) setValue("milestones_json", serializeJson(args.milestones));
  if (args.activity !== undefined) setValue("activity_json", serializeJson(args.activity));
  if (args.content !== undefined) setValue("content_json", serializeJson(args.content));
  if (args.predictions !== undefined) setValue("predictions_json", serializeJson(args.predictions));
  if (args.generatedAt !== undefined) setValue("generated_at", args.generatedAt);

  if (updates.length === 0) {
    return existing;
  }

  const timestamp = new Date().toISOString();
  updates.push("updated_at = ?");
  values.push(timestamp, args.teamId, args.id);

  await getInsightsD1(db)
    .prepare(
      `update insight_records
      set ${updates.join(", ")}
      where team_id = ? and id = ?`,
    )
    .bind(...values)
    .run();

  return getInsightRecordById(db, { teamId: args.teamId, id: args.id });
}

export async function listInsightUserStatuses(
  db: Database | DatabaseOrTransaction,
  args: { userId: string },
) {
  const { results = [] } = await getInsightsD1(db)
    .prepare(
      `select user_id, insight_id, read_at, dismissed_at, created_at, updated_at
      from insight_user_statuses
      where user_id = ?`,
    )
    .bind(args.userId)
    .all<InsightUserStatusRow>();

  return results.map(toInsightUserStatus);
}

async function getInsightUserStatusRow(
  db: Database | DatabaseOrTransaction,
  args: { userId: string; insightId: string },
) {
  return getInsightsD1(db)
    .prepare(
      `select user_id, insight_id, read_at, dismissed_at, created_at, updated_at
      from insight_user_statuses
      where user_id = ? and insight_id = ?`,
    )
    .bind(args.userId, args.insightId)
    .first<InsightUserStatusRow>();
}

export async function markInsightStatusAsRead(
  db: Database | DatabaseOrTransaction,
  args: { userId: string; insightId: string },
) {
  const timestamp = new Date().toISOString();
  const existing = await getInsightUserStatusRow(db, args);

  if (existing) {
    const readAt = existing.read_at ?? timestamp;
    await getInsightsD1(db)
      .prepare(
        `update insight_user_statuses
        set read_at = ?, updated_at = ?
        where user_id = ? and insight_id = ?`,
      )
      .bind(readAt, timestamp, args.userId, args.insightId)
      .run();

    return {
      ...toInsightUserStatus(existing),
      readAt,
      updatedAt: timestamp,
    };
  }

  await getInsightsD1(db)
    .prepare(
      `insert into insight_user_statuses (
        user_id,
        insight_id,
        read_at,
        created_at,
        updated_at
      ) values (?, ?, ?, ?, ?)`,
    )
    .bind(args.userId, args.insightId, timestamp, timestamp, timestamp)
    .run();

  return {
    userId: args.userId,
    insightId: args.insightId,
    readAt: timestamp,
    dismissedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  } satisfies InsightUserStatusRecord;
}

export async function dismissInsightStatus(
  db: Database | DatabaseOrTransaction,
  args: { userId: string; insightId: string },
) {
  const timestamp = new Date().toISOString();
  const existing = await getInsightUserStatusRow(db, args);

  if (existing) {
    await getInsightsD1(db)
      .prepare(
        `update insight_user_statuses
        set dismissed_at = ?, updated_at = ?
        where user_id = ? and insight_id = ?`,
      )
      .bind(timestamp, timestamp, args.userId, args.insightId)
      .run();

    return {
      ...toInsightUserStatus(existing),
      dismissedAt: timestamp,
      updatedAt: timestamp,
    };
  }

  await getInsightsD1(db)
    .prepare(
      `insert into insight_user_statuses (
        user_id,
        insight_id,
        dismissed_at,
        created_at,
        updated_at
      ) values (?, ?, ?, ?, ?)`,
    )
    .bind(args.userId, args.insightId, timestamp, timestamp, timestamp)
    .run();

  return {
    userId: args.userId,
    insightId: args.insightId,
    readAt: null,
    dismissedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  } satisfies InsightUserStatusRecord;
}

export async function undoDismissInsightStatus(
  db: Database | DatabaseOrTransaction,
  args: { userId: string; insightId: string },
) {
  const existing = await getInsightUserStatusRow(db, args);

  if (!existing) {
    return null;
  }

  const timestamp = new Date().toISOString();
  await getInsightsD1(db)
    .prepare(
      `update insight_user_statuses
      set dismissed_at = null, updated_at = ?
      where user_id = ? and insight_id = ?`,
    )
    .bind(timestamp, args.userId, args.insightId)
    .run();

  return {
    ...toInsightUserStatus(existing),
    dismissedAt: null,
    updatedAt: timestamp,
  };
}
