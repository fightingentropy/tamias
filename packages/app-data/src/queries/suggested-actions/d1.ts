import {
  requireCloudflareD1Database,
  type CloudflareD1DatabaseBinding,
  type Database,
} from "../../client";
import type { SuggestedActionUsageMap, SuggestedActionUsageParams } from "../suggested-actions";

const SUGGESTED_ACTION_USAGE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

type SuggestedActionUsageRow = {
  user_id: string;
  team_id: string;
  action_id: string;
  count: number;
  last_used_at: string;
  created_at: string;
  updated_at: string;
};

export function getSuggestedActionUsageD1(db: Database) {
  return requireCloudflareD1Database(db);
}

function getCutoffIso(now = Date.now()) {
  return new Date(now - SUGGESTED_ACTION_USAGE_WINDOW_MS).toISOString();
}

function rowsToUsageMap(rows: SuggestedActionUsageRow[]): SuggestedActionUsageMap {
  return Object.fromEntries(
    rows.map((row) => [
      row.action_id,
      {
        actionId: row.action_id,
        count: row.count,
        lastUsed: row.last_used_at,
      },
    ]),
  );
}

export async function getSuggestedActionUsageFromD1(
  d1: CloudflareD1DatabaseBinding,
  params: SuggestedActionUsageParams,
) {
  const { results = [] } = await d1
    .prepare(
      `select *
       from suggested_action_usage
       where user_id = ?
         and team_id = ?
         and last_used_at >= ?
       order by count desc, last_used_at desc`,
    )
    .bind(params.userId, params.teamId, getCutoffIso())
    .all<SuggestedActionUsageRow>();

  return rowsToUsageMap(results);
}

export async function incrementSuggestedActionUsageInD1(
  d1: CloudflareD1DatabaseBinding,
  params: SuggestedActionUsageParams & { actionId: string },
) {
  const now = new Date().toISOString();

  await d1
    .prepare(
      `insert into suggested_action_usage (
        user_id,
        team_id,
        action_id,
        count,
        last_used_at,
        created_at,
        updated_at
      ) values (?, ?, ?, 1, ?, ?, ?)
      on conflict(user_id, team_id, action_id) do update set
        count = case
          when suggested_action_usage.last_used_at >= ? then suggested_action_usage.count + 1
          else 1
        end,
        last_used_at = excluded.last_used_at,
        updated_at = excluded.updated_at`,
    )
    .bind(params.userId, params.teamId, params.actionId, now, now, now, getCutoffIso())
    .run();
}
