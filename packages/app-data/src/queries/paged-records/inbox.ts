import type { Database } from "../../client";
import {
  getInboxItemsByDatePageFromD1,
  getInboxItemsPageFromD1,
  requireInboxItemsD1,
  type InboxItemStatus,
} from "../inbox/d1";
import { collectCursorPages, DEFAULT_PAGE_SIZE } from "./shared";

export async function getInboxItemsPaged(
  db: Database,
  args: {
    teamId: string;
    status?: InboxItemStatus;
    createdAtFrom?: string;
    createdAtTo?: string;
    order?: "asc" | "desc";
    pageSize?: number;
  },
) {
  const d1 = requireInboxItemsD1(db);

  return collectCursorPages((cursor) =>
    getInboxItemsPageFromD1(d1, {
      teamId: args.teamId,
      cursor,
      pageSize: args.pageSize ?? DEFAULT_PAGE_SIZE,
      status: args.status,
      order: args.order ?? "desc",
      createdAtFrom: args.createdAtFrom,
      createdAtTo: args.createdAtTo,
    }),
  );
}

export async function getInboxItemsByDatePaged(
  db: Database,
  args: {
    teamId: string;
    dateGte?: string | null;
    dateLte?: string | null;
    order?: "asc" | "desc";
    pageSize?: number;
  },
) {
  const d1 = requireInboxItemsD1(db);

  return collectCursorPages((cursor) =>
    getInboxItemsByDatePageFromD1(d1, {
      teamId: args.teamId,
      cursor,
      pageSize: args.pageSize ?? DEFAULT_PAGE_SIZE,
      order: args.order ?? "desc",
      dateGte: args.dateGte,
      dateLte: args.dateLte,
    }),
  );
}
