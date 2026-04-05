import {
  getInboxItemsByDatePageFromConvex,
  getInboxItemsPageFromConvex,
  type InboxItemStatus,
} from "../../convex";
import { collectCursorPages, DEFAULT_PAGE_SIZE } from "./shared";

export async function getInboxItemsPaged(args: {
  teamId: string;
  status?: InboxItemStatus;
  createdAtFrom?: string;
  createdAtTo?: string;
  order?: "asc" | "desc";
  pageSize?: number;
}) {
  return collectCursorPages((cursor) =>
    getInboxItemsPageFromConvex({
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

export async function getInboxItemsByDatePaged(args: {
  teamId: string;
  dateGte?: string | null;
  dateLte?: string | null;
  order?: "asc" | "desc";
  pageSize?: number;
}) {
  return collectCursorPages((cursor) =>
    getInboxItemsByDatePageFromConvex({
      teamId: args.teamId,
      cursor,
      pageSize: args.pageSize ?? DEFAULT_PAGE_SIZE,
      order: args.order ?? "desc",
      dateGte: args.dateGte,
      dateLte: args.dateLte,
    }),
  );
}
