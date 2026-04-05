import {
  getTaggedTrackerProjectsPageFromConvex,
  getTrackerProjectsByIdsFromConvex,
  getTrackerProjectsPageFromConvex,
  searchTrackerProjectsFromConvex,
  type TrackerProjectRecord,
} from "../../../convex";
import type { Database } from "../../../client";
import { enrichProjects } from "../enrich";
import type {
  GetTrackerProjectsParams,
  TrackerProjectListItem,
} from "../types";
import { matchesProjectSearch } from "./shared";

const TRACKER_PROJECT_PAGE_CURSOR_PREFIX = "tracker-project:";

type IndexedTrackerProjectCursorState = {
  sourceCursor: string | null;
  sourceExhausted: boolean;
  bufferedIds: string[];
};

function decodeIndexedTrackerProjectCursor(
  cursor: string | null | undefined,
): IndexedTrackerProjectCursorState {
  if (!cursor?.startsWith(TRACKER_PROJECT_PAGE_CURSOR_PREFIX)) {
    return {
      sourceCursor: null,
      sourceExhausted: false,
      bufferedIds: [],
    };
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(
        cursor.slice(TRACKER_PROJECT_PAGE_CURSOR_PREFIX.length),
        "base64url",
      ).toString("utf8"),
    ) as Partial<IndexedTrackerProjectCursorState>;

    return {
      sourceCursor:
        typeof parsed.sourceCursor === "string" ? parsed.sourceCursor : null,
      sourceExhausted: parsed.sourceExhausted === true,
      bufferedIds: Array.isArray(parsed.bufferedIds)
        ? parsed.bufferedIds.filter(
            (bufferedId): bufferedId is string =>
              typeof bufferedId === "string",
          )
        : [],
    };
  } catch {
    return {
      sourceCursor: null,
      sourceExhausted: false,
      bufferedIds: [],
    };
  }
}

function encodeIndexedTrackerProjectCursor(
  state: IndexedTrackerProjectCursorState,
) {
  return `${TRACKER_PROJECT_PAGE_CURSOR_PREFIX}${Buffer.from(
    JSON.stringify(state),
    "utf8",
  ).toString("base64url")}`;
}

function getIndexedTrackerProjectOrder(sort: GetTrackerProjectsParams["sort"]) {
  if (!sort || sort.length === 0) {
    return "desc" as const;
  }

  if (sort.length !== 2) {
    return null;
  }

  const [column, direction] = sort;

  if (
    column !== "created_at" ||
    (direction !== "asc" && direction !== "desc")
  ) {
    return null;
  }

  return direction;
}

function getIndexedTrackerProjectBatchSize(pageSize: number) {
  return Math.min(Math.max(pageSize * 3, 50), 200);
}

function getIndexedTrackerProjectSearchLimit(pageSize: number) {
  return Math.min(Math.max(pageSize * 20, 100), 400);
}

export function canUseIndexedTrackerProjectPage(sort?: string[] | null) {
  return getIndexedTrackerProjectOrder(sort) !== null;
}

async function getTrackerProjectSearchCandidates(args: {
  teamId: string;
  query: string;
  status?: "in_progress" | "completed" | null;
  limit: number;
  order: "asc" | "desc";
}) {
  return (
    await searchTrackerProjectsFromConvex({
      teamId: args.teamId,
      query: args.query,
      status: args.status ?? undefined,
      limit: args.limit,
    })
  ).sort((left, right) =>
    args.order === "asc"
      ? left.createdAt.localeCompare(right.createdAt)
      : right.createdAt.localeCompare(left.createdAt),
  );
}

function matchesIndexedTrackerProjectCandidate(
  project: TrackerProjectRecord,
  args: {
    q?: string | null;
    status?: "in_progress" | "completed" | null;
    start?: string | null;
    end?: string | null;
    customerIds?: Set<string> | null;
  },
) {
  if (args.status && project.status !== args.status) {
    return false;
  }

  if (
    args.start &&
    args.end &&
    (project.createdAt < args.start || project.createdAt > args.end)
  ) {
    return false;
  }

  if (args.customerIds?.size) {
    if (!project.customerId || !args.customerIds.has(project.customerId)) {
      return false;
    }
  }

  return matchesProjectSearch(project, args.q);
}

function buildTrackerProjectPageResponse(args: {
  cursor: string | null | undefined;
  nextCursor: string | null | undefined;
  hasNextPage: boolean;
  data: TrackerProjectListItem[];
}) {
  return {
    meta: {
      cursor: args.nextCursor ?? null,
      hasPreviousPage: Boolean(args.cursor),
      hasNextPage: args.hasNextPage,
    },
    data: args.data,
  };
}

async function getTrackerProjectsByIdsInOrder(args: {
  teamId: string;
  projectIds: string[];
}) {
  if (args.projectIds.length === 0) {
    return [];
  }

  const projects = await getTrackerProjectsByIdsFromConvex({
    teamId: args.teamId,
    projectIds: args.projectIds,
  });
  const projectsById = new Map(
    projects.map((project) => [project.id, project]),
  );

  return args.projectIds.flatMap((projectId) => {
    const project = projectsById.get(projectId);

    return project ? [project] : [];
  });
}

export async function getIndexedTrackerProjectsPage(
  db: Database,
  params: GetTrackerProjectsParams,
) {
  const {
    teamId,
    sort,
    cursor,
    pageSize = 25,
    q,
    status,
    start,
    end,
    customers,
    tags,
  } = params;
  const order = getIndexedTrackerProjectOrder(sort) ?? "desc";
  const customerIds = customers?.length ? new Set(customers) : null;
  const hasTagFilter = Boolean(tags?.length);

  const cursorState = decodeIndexedTrackerProjectCursor(cursor);
  let sourceCursor = cursorState.sourceCursor;
  let sourceExhausted = cursorState.sourceExhausted;
  let bufferedIds = [...cursorState.bufferedIds];
  const eligibleProjects: TrackerProjectRecord[] = [];

  while (eligibleProjects.length <= pageSize && bufferedIds.length > 0) {
    const takeCount = pageSize + 1 - eligibleProjects.length;
    const bufferedProjects = await getTrackerProjectsByIdsInOrder({
      teamId,
      projectIds: bufferedIds.slice(0, takeCount),
    });

    bufferedIds = bufferedIds.slice(takeCount);
    eligibleProjects.push(
      ...bufferedProjects.filter((project) =>
        matchesIndexedTrackerProjectCandidate(project, {
          q,
          status,
          start,
          end,
          customerIds,
        }),
      ),
    );
  }

  if (
    eligibleProjects.length <= pageSize &&
    !hasTagFilter &&
    q &&
    !sourceExhausted &&
    !sourceCursor &&
    bufferedIds.length === 0
  ) {
    const searchCandidates = await getTrackerProjectSearchCandidates({
      teamId,
      query: q,
      status,
      limit: getIndexedTrackerProjectSearchLimit(pageSize),
      order,
    });

    eligibleProjects.push(
      ...searchCandidates.filter((project) =>
        matchesIndexedTrackerProjectCandidate(project, {
          q,
          status,
          start,
          end,
          customerIds,
        }),
      ),
    );
    sourceExhausted = true;
  }

  while (eligibleProjects.length <= pageSize && !sourceExhausted) {
    const previousSourceCursor = sourceCursor;
    const result = hasTagFilter
      ? await getTaggedTrackerProjectsPageFromConvex({
          teamId,
          tagIds: tags ?? [],
          cursor: sourceCursor,
          pageSize: getIndexedTrackerProjectBatchSize(pageSize),
          status: status ?? undefined,
          order,
        })
      : await getTrackerProjectsPageFromConvex({
          teamId,
          cursor: sourceCursor,
          pageSize: getIndexedTrackerProjectBatchSize(pageSize),
          status: status ?? undefined,
          order,
        });

    eligibleProjects.push(
      ...result.page.filter((project) =>
        matchesIndexedTrackerProjectCandidate(project, {
          q,
          status,
          start,
          end,
          customerIds,
        }),
      ),
    );

    sourceCursor = result.isDone ? null : result.continueCursor;
    sourceExhausted = result.isDone;

    if (
      result.page.length === 0 &&
      (result.isDone || sourceCursor === previousSourceCursor)
    ) {
      break;
    }
  }

  const pagedProjects = eligibleProjects.slice(0, pageSize);
  const nextBufferedIds = [
    ...eligibleProjects.slice(pageSize).map((project) => project.id),
    ...bufferedIds,
  ];
  const hasNextPage = nextBufferedIds.length > 0;
  const nextCursor = hasNextPage
    ? encodeIndexedTrackerProjectCursor({
        sourceCursor,
        sourceExhausted,
        bufferedIds: nextBufferedIds,
      })
    : undefined;
  const enriched = await enrichProjects(db, teamId, pagedProjects);

  return buildTrackerProjectPageResponse({
    cursor,
    nextCursor,
    hasNextPage,
    data: enriched,
  });
}
