import {
  getCustomersByIdsFromConvex,
  deleteTrackerProjectInConvex,
  type CurrentUserIdentityRecord,
  getTeamMembersFromConvexIdentity,
  getTagsByIdsFromConvex,
  getTrackerEntriesByProjectIdsFromConvex,
  getTrackerProjectAssignmentsForProjectIdsFromConvex,
  getTrackerProjectByIdFromConvex,
  getTrackerProjectIdsForTagIdsFromConvex,
  getTrackerProjectsByIdsFromConvex,
  getTrackerProjectsPageFromConvex,
  getTrackerProjectsFromConvex,
  replaceTrackerProjectTagsInConvex,
  upsertTrackerProjectInConvex,
  type TrackerEntryRecord,
  type TrackerProjectRecord,
} from "@tamias/app-data-convex";
import type { Database } from "../client";
import { createActivity } from "./activities";
import { getTeamById } from "./index";

type ConvexUserId = CurrentUserIdentityRecord["convexId"];
const TRACKER_PROJECT_PAGE_CURSOR_PREFIX = "tracker-project:";

type IndexedTrackerProjectCursorState = {
  sourceCursor: string | null;
  sourceExhausted: boolean;
  bufferedIds: string[];
};

export type GetTrackerProjectsParams = {
  teamId: string;
  cursor?: string | null;
  pageSize?: number;
  q?: string | null;
  start?: string | null;
  end?: string | null;
  status?: "in_progress" | "completed" | null;
  customers?: string[] | null;
  tags?: string[] | null;
  sort?: string[] | null;
};

type AssignedUser = {
  id: string;
  fullName: string;
  avatarUrl: string;
};

type TrackerProjectTag = {
  id: string;
  name: string;
};

type TrackerProjectListItem = TrackerProjectRecord & {
  totalDuration: number;
  totalAmount: number;
  customer: {
    id: string;
    name: string | null;
    website: string | null;
  } | null;
  team: {
    name: string | null;
  };
  tags: TrackerProjectTag[];
  users: AssignedUser[];
};

function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function matchesProjectSearch(
  project: TrackerProjectRecord,
  query?: string | null,
) {
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

function decodeIndexedTrackerProjectCursor(
  cursor: string | null | undefined,
): IndexedTrackerProjectCursorState {
  if (!cursor || !cursor.startsWith(TRACKER_PROJECT_PAGE_CURSOR_PREFIX)) {
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

function getIndexedTrackerProjectOrder(
  sort: GetTrackerProjectsParams["sort"],
) {
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

function canUseIndexedTrackerProjectPage(sort?: string[] | null) {
  return getIndexedTrackerProjectOrder(sort) !== null;
}

function paginate<T>(items: T[], cursor?: string | null, pageSize = 25) {
  const offset = cursor ? Number.parseInt(cursor, 10) : 0;
  const data = items.slice(offset, offset + pageSize);
  const nextCursor =
    offset + pageSize < items.length
      ? (offset + pageSize).toString()
      : undefined;

  return {
    meta: {
      cursor: nextCursor,
      hasPreviousPage: offset > 0,
      hasNextPage: offset + pageSize < items.length,
    },
    data,
  };
}

async function getTeamName(db: Database, teamId: string) {
  const team = await getTeamById(db, teamId);

  return team?.name ?? null;
}

async function getCustomersByIds(teamId: string, customerIds: string[]) {
  if (customerIds.length === 0) {
    return new Map<
      string,
      {
        id: string;
        name: string | null;
        website: string | null;
      }
    >();
  }

  const rows = await getCustomersByIdsFromConvex({
    teamId,
    customerIds: [...new Set(customerIds)],
  });

  return new Map(rows.map((row) => [row.id, row]));
}

async function getAssignedUsersByProject(
  _db: Database,
  teamId: string,
  entries: TrackerEntryRecord[],
) {
  const assignedIds = new Set(
    entries.map((entry) => entry.assignedId).filter(isDefined),
  );

  if (assignedIds.size === 0) {
    return new Map<string, AssignedUser[]>();
  }

  const userById = new Map(
    (await getTeamMembersFromConvexIdentity({ teamId }))
      .filter((member) => assignedIds.has(member.user.convexId))
      .map((member) => [
        member.user.convexId,
        {
          id: member.user.convexId,
          fullName: member.user.fullName ?? "",
          avatarUrl: member.user.avatarUrl ?? "",
        },
      ]),
  );

  const assignments = new Map<string, AssignedUser[]>();

  for (const entry of entries) {
    if (!entry.projectId || !entry.assignedId) {
      continue;
    }

    const user = userById.get(entry.assignedId);

    if (!user) {
      continue;
    }

    const current = assignments.get(entry.projectId) ?? [];

    if (current.some((member) => member.id === user.id)) {
      continue;
    }

    current.push(user);
    assignments.set(entry.projectId, current);
  }

  return assignments;
}

async function getTrackerProjectTagsByProject(
  teamId: string,
  projectIds: string[],
) {
  if (projectIds.length === 0) {
    return new Map<string, TrackerProjectTag[]>();
  }

  const assignments = await getTrackerProjectAssignmentsForProjectIdsFromConvex(
    {
      teamId,
      trackerProjectIds: projectIds,
    },
  );
  const tagIds = [
    ...new Set(assignments.map((assignment) => assignment.tagId)),
  ];

  if (tagIds.length === 0) {
    return new Map<string, TrackerProjectTag[]>();
  }

  const tags = await getTagsByIdsFromConvex({
    teamId,
    tagIds,
  });
  const tagNameById = new Map(tags.map((tag) => [tag.id, tag.name]));
  const tagsByProject = new Map<string, TrackerProjectTag[]>();

  for (const assignment of assignments) {
    const tagName = tagNameById.get(assignment.tagId);

    if (!tagName) {
      continue;
    }

    const current = tagsByProject.get(assignment.trackerProjectId) ?? [];
    current.push({
      id: assignment.tagId,
      name: tagName,
    });
    tagsByProject.set(assignment.trackerProjectId, current);
  }

  return tagsByProject;
}

function buildTotalsByProject(
  projects: TrackerProjectRecord[],
  entries: TrackerEntryRecord[],
) {
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const totals = new Map<
    string,
    {
      totalDuration: number;
      totalAmount: number;
    }
  >();

  for (const entry of entries) {
    if (!entry.projectId) {
      continue;
    }

    const project = projectById.get(entry.projectId);

    if (!project) {
      continue;
    }

    const current = totals.get(entry.projectId) ?? {
      totalDuration: 0,
      totalAmount: 0,
    };
    const duration = entry.duration ?? 0;
    const hourlyRate = entry.rate ?? project.rate ?? 0;

    current.totalDuration += duration;
    current.totalAmount += (hourlyRate * duration) / 3600;
    totals.set(entry.projectId, current);
  }

  return totals;
}

async function enrichProjects(
  db: Database,
  teamId: string,
  projects: TrackerProjectRecord[],
) {
  const [teamName, tagsByProject, projectEntries, customersById] =
    await Promise.all([
      getTeamName(db, teamId),
      getTrackerProjectTagsByProject(
        teamId,
        projects.map((project) => project.id),
      ),
      getTrackerEntriesByProjectIdsFromConvex({
        teamId,
        projectIds: projects.map((project) => project.id),
      }),
      getCustomersByIds(
        teamId,
        projects.map((project) => project.customerId).filter(isDefined),
      ),
    ]);

  const [assignedUsersByProject, totalsByProject] = await Promise.all([
    getAssignedUsersByProject(db, teamId, projectEntries),
    Promise.resolve(buildTotalsByProject(projects, projectEntries)),
  ]);

  return projects.map<TrackerProjectListItem>((project) => {
    const totals = totalsByProject.get(project.id) ?? {
      totalDuration: 0,
      totalAmount: 0,
    };
    const customer = project.customerId
      ? (customersById.get(project.customerId) ?? {
          id: project.customerId,
          name: null,
          website: null,
        })
      : null;

    return {
      ...project,
      totalDuration: totals.totalDuration,
      totalAmount: totals.totalAmount,
      customer,
      team: {
        name: teamName,
      },
      tags: tagsByProject.get(project.id) ?? [],
      users: assignedUsersByProject.get(project.id) ?? [],
    };
  });
}

function matchesIndexedTrackerProjectCandidate(
  project: TrackerProjectRecord,
  args: {
    q?: string | null;
    status?: "in_progress" | "completed" | null;
    start?: string | null;
    end?: string | null;
    customerIds?: Set<string> | null;
    trackerProjectIds?: Set<string> | null;
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

  if (args.trackerProjectIds && !args.trackerProjectIds.has(project.id)) {
    return false;
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
  const projectsById = new Map(projects.map((project) => [project.id, project]));

  return args.projectIds.flatMap((projectId) => {
    const project = projectsById.get(projectId);

    return project ? [project] : [];
  });
}

async function getIndexedTrackerProjectsPage(
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
  const trackerProjectIds =
    tags?.length
      ? new Set(
          await getTrackerProjectIdsForTagIdsFromConvex({
            teamId,
            tagIds: tags,
          }),
        )
      : null;

  if (trackerProjectIds && trackerProjectIds.size === 0) {
    return buildTrackerProjectPageResponse({
      cursor,
      nextCursor: undefined,
      hasNextPage: false,
      data: [],
    });
  }

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
          trackerProjectIds,
        }),
      ),
    );
  }

  while (eligibleProjects.length <= pageSize && !sourceExhausted) {
    const result = await getTrackerProjectsPageFromConvex({
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
          trackerProjectIds,
        }),
      ),
    );

    sourceCursor = result.isDone ? null : result.continueCursor;
    sourceExhausted = result.isDone;

    if (result.page.length === 0) {
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

function sortTrackerProjects(
  data: TrackerProjectListItem[],
  sort?: string[] | null,
) {
  const [column, direction = "desc"] = sort ?? [];
  const isAscending = direction === "asc";
  const ordered = [...data];

  ordered.sort((left, right) => {
    const compare = (() => {
      switch (column) {
        case "time":
          return left.totalDuration - right.totalDuration;
        case "amount":
          return left.totalAmount - right.totalAmount;
        case "assigned":
          return left.users.length - right.users.length;
        case "customer":
          return (left.customer?.name ?? "").localeCompare(
            right.customer?.name ?? "",
          );
        case "name":
          return left.name.localeCompare(right.name);
        case "tags":
          return left.tags.length - right.tags.length;
        case "created_at":
        default:
          return left.createdAt.localeCompare(right.createdAt);
      }
    })();

    if (compare !== 0) {
      return isAscending ? compare : -compare;
    }

    return right.createdAt.localeCompare(left.createdAt);
  });

  return ordered;
}

export async function getTrackerProjects(
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
    customers: customerIds,
    tags: tagIds,
  } = params;

  if (canUseIndexedTrackerProjectPage(sort)) {
    return getIndexedTrackerProjectsPage(db, params);
  }

  let projects = await getTrackerProjectsFromConvex({ teamId });

  if (status) {
    projects = projects.filter((project) => project.status === status);
  }

  if (start && end) {
    projects = projects.filter(
      (project) => project.createdAt >= start && project.createdAt <= end,
    );
  }

  if (customerIds?.length) {
    const customerSet = new Set(customerIds);
    projects = projects.filter(
      (project) => project.customerId && customerSet.has(project.customerId),
    );
  }

  if (tagIds?.length) {
    const trackerProjectIds = await getTrackerProjectIdsForTagIdsFromConvex({
      teamId,
      tagIds,
    });
    const trackerProjectIdSet = new Set(trackerProjectIds);

    projects = projects.filter((project) =>
      trackerProjectIdSet.has(project.id),
    );
  }

  projects = projects.filter((project) => matchesProjectSearch(project, q));

  const enriched = await enrichProjects(db, teamId, projects);
  const ordered = sortTrackerProjects(enriched, sort);

  return paginate(ordered, cursor, pageSize);
}

export type DeleteTrackerProjectParams = {
  teamId: string;
  id: string;
};

export async function deleteTrackerProject(
  _db: Database,
  params: DeleteTrackerProjectParams,
) {
  return deleteTrackerProjectInConvex({
    teamId: params.teamId,
    id: params.id,
  });
}

export type UpsertTrackerProjectParams = {
  id?: string;
  name: string;
  description?: string | null;
  estimate?: number | null;
  billable?: boolean | null;
  rate?: number | null;
  currency?: string | null;
  customerId?: string | null;
  teamId: string;
  userId?: ConvexUserId;
  tags?: { id: string; value: string }[] | null;
};

export async function upsertTrackerProject(
  db: Database,
  params: UpsertTrackerProjectParams,
) {
  const projectId = params.id ?? crypto.randomUUID();

  await upsertTrackerProjectInConvex({
    id: projectId,
    teamId: params.teamId,
    name: params.name,
    description: params.description,
    customerId: params.customerId,
    estimate: params.estimate,
    billable: params.billable,
    currency: params.currency,
    rate: params.rate,
  });

  if (!params.id) {
    createActivity(db, {
      teamId: params.teamId,
      userId: params.userId,
      type: "tracker_project_created",
      source: "user",
      priority: 7,
      metadata: {
        projectId,
        name: params.name,
        description: params.description || null,
        billable: params.billable || false,
        rate: params.rate || null,
        currency: params.currency || null,
        customerId: params.customerId || null,
        estimate: params.estimate || null,
      },
    });
  }

  if (params.tags) {
    await replaceTrackerProjectTagsInConvex({
      teamId: params.teamId,
      trackerProjectId: projectId,
      tagIds: params.tags.map((tag) => tag.id),
    });
  }

  return getTrackerProjectById(db, {
    teamId: params.teamId,
    id: projectId,
  });
}

export type GetTrackerProjectByIdParams = {
  teamId: string;
  id: string;
};

export async function getTrackerProjectById(
  db: Database,
  params: GetTrackerProjectByIdParams,
) {
  const project = await getTrackerProjectByIdFromConvex({
    teamId: params.teamId,
    id: params.id,
  });

  if (!project) {
    return null;
  }

  const [enriched] = await enrichProjects(db, params.teamId, [project]);

  return enriched ?? null;
}
