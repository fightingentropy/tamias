import {
  type CurrentUserIdentityRecord,
  getCustomersByIdsFromConvex,
  getTeamMembersFromConvexIdentity,
  getTrackerProjectsByIdsFromConvex,
  type TrackerEntryRecord,
  type TrackerProjectRecord,
} from "@tamias/app-data-convex";
import type { Database } from "../../client";

type ConvexUserId = CurrentUserIdentityRecord["convexId"];

function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
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

async function getUsersByIds(
  _db: Database,
  teamId: string,
  assignedIds: string[],
) {
  if (assignedIds.length === 0) {
    return new Map<
      string,
      {
        id: string;
        fullName: string | null;
        avatarUrl: string | null;
      }
    >();
  }

  const assignedIdSet = new Set(assignedIds);

  return new Map(
    (await getTeamMembersFromConvexIdentity({ teamId }))
      .filter((member) => assignedIdSet.has(member.user.convexId))
      .map((member) => [
        member.user.convexId,
        {
          id: member.user.convexId,
          fullName: member.user.fullName,
          avatarUrl: member.user.avatarUrl,
        },
      ]),
  );
}

export type EnrichedTrackerProject = TrackerProjectRecord & {
  customer: {
    id: string;
    name: string | null;
    website: string | null;
  } | null;
};

export type EnrichedTrackerEntry = TrackerEntryRecord & {
  user: {
    id: string;
    fullName: string | null;
    avatarUrl: string | null;
  } | null;
  trackerProject: EnrichedTrackerProject | null;
};

export async function enrichTrackerEntries(
  db: Database,
  teamId: string,
  entries: TrackerEntryRecord[],
): Promise<EnrichedTrackerEntry[]> {
  const projectIds = [
    ...new Set(entries.map((entry) => entry.projectId).filter(isDefined)),
  ];
  const projects = await getTrackerProjectsByIdsFromConvex({
    teamId,
    projectIds,
  });
  const customersById = await getCustomersByIds(
    teamId,
    projects.map((project) => project.customerId).filter(isDefined),
  );
  const projectById = new Map<string, EnrichedTrackerProject>(
    projects.map((project) => [
      project.id,
      {
        ...project,
        customer: project.customerId
          ? (customersById.get(project.customerId) ?? {
              id: project.customerId,
              name: null,
              website: null,
            })
          : null,
      },
    ]),
  );
  const usersById = await getUsersByIds(
    db,
    teamId,
    entries.map((entry) => entry.assignedId).filter(isDefined),
  );

  return entries.map((entry) => ({
    ...entry,
    user: entry.assignedId ? (usersById.get(entry.assignedId) ?? null) : null,
    trackerProject: entry.projectId
      ? (projectById.get(entry.projectId) ?? null)
      : null,
  }));
}
