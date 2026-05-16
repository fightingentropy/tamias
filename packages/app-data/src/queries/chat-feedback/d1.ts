import {
  requireCloudflareD1Database,
  type CloudflareD1DatabaseBinding,
  type Database,
} from "../../client";
import type { DeleteChatFeedbackParams, UpsertChatFeedbackParams } from "../chat-feedback";

export function getChatFeedbackD1(db: Database) {
  return requireCloudflareD1Database(db);
}

export async function upsertChatFeedbackInD1(
  d1: CloudflareD1DatabaseBinding,
  params: UpsertChatFeedbackParams,
) {
  const timestamp = new Date().toISOString();

  await d1
    .prepare(
      `insert into chat_feedback (
        chat_id,
        message_id,
        user_id,
        team_id,
        type,
        comment,
        created_at,
        updated_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?)
      on conflict(chat_id, message_id, user_id) do update set
        team_id = excluded.team_id,
        type = excluded.type,
        comment = excluded.comment,
        updated_at = excluded.updated_at`,
    )
    .bind(
      params.chatId,
      params.messageId,
      params.userId,
      params.teamId,
      params.type,
      params.comment ?? null,
      timestamp,
      timestamp,
    )
    .run();
}

export async function deleteChatFeedbackFromD1(
  d1: CloudflareD1DatabaseBinding,
  params: DeleteChatFeedbackParams,
) {
  await d1
    .prepare(
      `delete from chat_feedback
       where chat_id = ?
         and message_id = ?
         and user_id = ?`,
    )
    .bind(params.chatId, params.messageId, params.userId)
    .run();
}
