import { convexApi, createClient, serviceArgs } from "./base";

export type TrackerProjectRecord = {
  id: string;
  teamId: string;
  name: string;
  description: string | null;
  status: "in_progress" | "completed";
  customerId: string | null;
  estimate: number | null;
  currency: string | null;
  billable: boolean;
  rate: number | null;
  createdAt: string;
  updatedAt: string;
};

export type UpsertTrackerProjectInput = {
  id: string;
  teamId: string;
  name: string;
  description?: string | null;
  status?: "in_progress" | "completed";
  customerId?: string | null;
  estimate?: number | null;
  currency?: string | null;
  billable?: boolean | null;
  rate?: number | null;
};

export async function getTrackerProjectsFromConvex(args: {
  teamId: string;
  status?: "in_progress" | "completed";
}) {
  const projects: TrackerProjectRecord[] = [];
  let cursor: string | null = null;

  while (true) {
    const result = await getTrackerProjectsPageFromConvex({
      teamId: args.teamId,
      status: args.status,
      cursor,
      pageSize: 200,
      order: "desc",
    });

    projects.push(...result.page);

    if (result.isDone) {
      return projects;
    }

    cursor = result.continueCursor;
  }
}

export async function getTrackerProjectsPageFromConvex(args: {
  teamId: string;
  cursor?: string | null;
  pageSize: number;
  status?: "in_progress" | "completed";
  order?: "asc" | "desc";
}) {
  return createClient().query(
    convexApi.trackerProjects.serviceListTrackerProjectsPage,
    serviceArgs({
      teamId: args.teamId,
      status: args.status,
      order: args.order,
      paginationOpts: {
        numItems: args.pageSize,
        cursor: args.cursor ?? null,
      },
    }),
  ) as Promise<{
    page: TrackerProjectRecord[];
    isDone: boolean;
    continueCursor: string;
  }>;
}

export async function searchTrackerProjectsFromConvex(args: {
  teamId: string;
  query: string;
  status?: "in_progress" | "completed";
  limit?: number;
}) {
  return createClient().query(
    convexApi.trackerProjects.serviceSearchTrackerProjects,
    serviceArgs({
      teamId: args.teamId,
      query: args.query,
      status: args.status,
      limit: args.limit,
    }),
  ) as Promise<TrackerProjectRecord[]>;
}

export async function getTaggedTrackerProjectsPageFromConvex(args: {
  teamId: string;
  tagIds: string[];
  status?: "in_progress" | "completed";
  pageSize: number;
  cursor?: string | null;
  order?: "asc" | "desc";
}) {
  return createClient().query(
    convexApi.trackerProjects.serviceListTaggedTrackerProjectsPage,
    serviceArgs({
      teamId: args.teamId,
      tagIds: args.tagIds,
      status: args.status,
      pageSize: args.pageSize,
      cursor: args.cursor ?? null,
      order: args.order,
    }),
  ) as Promise<{
    page: TrackerProjectRecord[];
    isDone: boolean;
    continueCursor: string | null;
  }>;
}

export async function getTaggedTrackerProjectsFromConvex(args: {
  teamId: string;
  tagIds: string[];
  status?: "in_progress" | "completed";
}) {
  const projects: TrackerProjectRecord[] = [];
  let cursor: string | null = null;

  while (true) {
    const result = await getTaggedTrackerProjectsPageFromConvex({
      teamId: args.teamId,
      tagIds: args.tagIds,
      status: args.status,
      cursor,
      pageSize: 200,
      order: "desc",
    });

    projects.push(...result.page);

    if (result.isDone) {
      return projects;
    }

    cursor = result.continueCursor;
  }
}

export async function rebuildTrackerProjectSearchTextsInConvex(args: {
  teamId?: string | null;
}) {
  return createClient().mutation(
    convexApi.trackerProjects.serviceRebuildTrackerProjectSearchTexts,
    serviceArgs({
      teamId: args.teamId ?? null,
    }),
  ) as Promise<
    Array<{
      teamId: string;
      projectCount: number;
      updatedProjectCount: number;
    }>
  >;
}

export async function getTrackerProjectsByIdsFromConvex(args: {
  teamId: string;
  projectIds: string[];
}) {
  return createClient().query(
    convexApi.trackerProjects.serviceGetTrackerProjectsByIds,
    serviceArgs({
      teamId: args.teamId,
      projectIds: args.projectIds,
    }),
  ) as Promise<TrackerProjectRecord[]>;
}

export async function getTrackerProjectsByCustomerIdsFromConvex(args: {
  teamId: string;
  customerIds: string[];
}) {
  return createClient().query(
    convexApi.trackerProjects.serviceGetTrackerProjectsByCustomerIds,
    serviceArgs({
      teamId: args.teamId,
      customerIds: args.customerIds,
    }),
  ) as Promise<TrackerProjectRecord[]>;
}

export async function getTrackerProjectByIdFromConvex(args: {
  teamId: string;
  id: string;
}) {
  return createClient().query(
    convexApi.trackerProjects.serviceGetTrackerProjectById,
    serviceArgs({
      teamId: args.teamId,
      id: args.id,
    }),
  ) as Promise<TrackerProjectRecord | null>;
}

export async function upsertTrackerProjectInConvex(
  args: UpsertTrackerProjectInput,
) {
  return createClient().mutation(
    convexApi.trackerProjects.serviceUpsertTrackerProject,
    serviceArgs({
      teamId: args.teamId,
      id: args.id,
      name: args.name,
      description: args.description,
      status: args.status,
      customerId: args.customerId,
      estimate: args.estimate,
      currency: args.currency,
      billable: args.billable,
      rate: args.rate,
    }),
  ) as Promise<TrackerProjectRecord>;
}

export async function deleteTrackerProjectInConvex(args: {
  teamId: string;
  id: string;
}) {
  return createClient().mutation(
    convexApi.trackerProjects.serviceDeleteTrackerProject,
    serviceArgs({
      teamId: args.teamId,
      id: args.id,
    }),
  ) as Promise<{ id: string } | null>;
}
