import type { TrackerProjectRecord } from "@tamias/app-data-convex";
import type { GetTrackerProjectsParams } from "../types";

export function serializeTrackerProjectListParams(params: GetTrackerProjectsParams) {
  return [
    params.teamId,
    params.cursor ?? "",
    params.pageSize ?? 25,
    params.q ?? "",
    params.start ?? "",
    params.end ?? "",
    params.status ?? "",
    [...(params.customers ?? [])].sort().join(","),
    [...(params.tags ?? [])].sort().join(","),
    (params.sort ?? []).join(","),
  ].join(":");
}

export function matchesProjectSearch(project: TrackerProjectRecord, query?: string | null) {
  if (!query) {
    return true;
  }

  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return true;
  }

  return [project.name, project.description ?? ""].some((value) =>
    value.toLowerCase().includes(normalized),
  );
}

export function paginate<T>(items: T[], cursor?: string | null, pageSize = 25) {
  const offset = cursor ? Number.parseInt(cursor, 10) : 0;
  const data = items.slice(offset, offset + pageSize);
  const nextCursor = offset + pageSize < items.length ? (offset + pageSize).toString() : undefined;

  return {
    meta: {
      cursor: nextCursor,
      hasPreviousPage: offset > 0,
      hasNextPage: offset + pageSize < items.length,
    },
    data,
  };
}
