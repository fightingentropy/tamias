import { getPublicInvoicesPageFromConvex } from "@tamias/app-data-convex";
import { normalizeTimestampBoundary } from "../date-boundaries";
import { getProjectedInvoicePayload, type ProjectedInvoiceRecord } from "../invoices/shared";
import { collectCursorPages, DEFAULT_PAGE_SIZE } from "./shared";

async function collectPublicInvoicePages(args: {
  teamId: string;
  status?: string;
  createdAtFrom?: string;
  createdAtTo?: string;
  pageSize?: number;
}) {
  return collectCursorPages((cursor) =>
    getPublicInvoicesPageFromConvex({
      teamId: args.teamId,
      cursor,
      pageSize: args.pageSize ?? DEFAULT_PAGE_SIZE,
      status: args.status,
      order: "asc",
      createdAtFrom: args.createdAtFrom,
      createdAtTo: args.createdAtTo,
    }),
  );
}

export async function getProjectedInvoicesPaged(args: {
  teamId: string;
  statuses?: string[];
  createdAtFrom?: string;
  createdAtTo?: string;
  pageSize?: number;
}) {
  const createdAtFrom = args.createdAtFrom
    ? normalizeTimestampBoundary(args.createdAtFrom, "start")
    : undefined;
  const createdAtTo = args.createdAtTo
    ? normalizeTimestampBoundary(args.createdAtTo, "end")
    : undefined;
  const statuses = args.statuses && args.statuses.length > 0 ? [...new Set(args.statuses)] : null;

  const records = statuses
    ? (
        await Promise.all(
          statuses.map((status) =>
            collectPublicInvoicePages({
              teamId: args.teamId,
              status,
              createdAtFrom,
              createdAtTo,
              pageSize: args.pageSize,
            }),
          ),
        )
      ).flat()
    : await collectPublicInvoicePages({
        teamId: args.teamId,
        createdAtFrom,
        createdAtTo,
        pageSize: args.pageSize,
      });

  return records.flatMap((record) => {
    const projected = getProjectedInvoicePayload(record);

    return projected && projected.teamId === args.teamId ? [projected] : [];
  }) as ProjectedInvoiceRecord[];
}
