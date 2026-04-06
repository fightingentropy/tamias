import { api, createClient, serviceArgs } from "./base";

export type TrackerProjectTagAssignmentRecord = {
  trackerProjectId: string;
  tagId: string;
  teamId: string;
  createdAt: string;
  updatedAt: string;
};

export async function getTrackerProjectAssignmentsForProjectIdsFromConvex(args: {
  teamId: string;
  trackerProjectIds: string[];
}) {
  return createClient().query(
    api.trackerProjectTags.serviceGetTrackerProjectTagAssignmentsForProjectIds,
    serviceArgs({
      teamId: args.teamId,
      trackerProjectIds: args.trackerProjectIds,
    }),
  ) as Promise<TrackerProjectTagAssignmentRecord[]>;
}

export async function rebuildTrackerProjectTagSortFieldsInConvex(args: { teamId?: string | null }) {
  return createClient().mutation(
    api.trackerProjectTags.serviceRebuildTrackerProjectTagSortFields,
    serviceArgs({
      teamId: args.teamId ?? null,
    }),
  ) as Promise<
    Array<{
      teamId: string;
      assignmentCount: number;
      updatedAssignmentCount: number;
      deletedAssignmentCount: number;
    }>
  >;
}

export async function replaceTrackerProjectTagsInConvex(args: {
  teamId: string;
  trackerProjectId: string;
  tagIds: string[];
}) {
  return createClient().mutation(
    api.trackerProjectTags.serviceReplaceTrackerProjectTags,
    serviceArgs({
      teamId: args.teamId,
      trackerProjectId: args.trackerProjectId,
      tagIds: args.tagIds,
    }),
  ) as Promise<TrackerProjectTagAssignmentRecord[]>;
}

export async function deleteTrackerProjectTagsForProjectInConvex(args: {
  teamId: string;
  trackerProjectId: string;
}) {
  return createClient().mutation(
    api.trackerProjectTags.serviceDeleteTrackerProjectTagsForProject,
    serviceArgs({
      teamId: args.teamId,
      trackerProjectId: args.trackerProjectId,
    }),
  ) as Promise<{ trackerProjectId: string }>;
}

export async function deleteTrackerProjectTagsForTagInConvex(args: {
  teamId: string;
  tagId: string;
}) {
  return createClient().mutation(
    api.trackerProjectTags.serviceDeleteTrackerProjectTagsForTag,
    serviceArgs({
      teamId: args.teamId,
      tagId: args.tagId,
    }),
  ) as Promise<{ tagId: string }>;
}
