import type { Database } from "../../client";
import { getCustomersByIdsFromD1, requireCustomersD1 } from "../customers/d1";
import { getTeamMembers } from "../teams";
import { getTrackerProjectsByIdsFromD1, requireTrackerProjectsD1 } from "../tracker-projects/d1";
import type { TrackerProjectRecord } from "../tracker-projects/types";

export type TrackerEntryRecord = {
  id: string;
  teamId: string;
  projectId: string | null;
  assignedId: string | null;
  description: string | null;
  start: string | null;
  stop: string | null;
  duration: number | null;
  date: string;
  rate: number | null;
  currency: string | null;
  billed: boolean;
  createdAt: string;
  updatedAt: string;
};

export type UpsertTrackerEntryInput = {
  id: string;
  teamId: string;
  projectId?: string | null;
  assignedId?: string | null;
  description?: string | null;
  start?: string | null;
  stop?: string | null;
  duration?: number | null;
  date: string;
  rate?: number | null;
  currency?: string | null;
  billed?: boolean | null;
};

function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

async function getCustomersByIds(db: Database, teamId: string, customerIds: string[]) {
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

  const rows = await getCustomersByIdsFromD1(requireCustomersD1(db), {
    teamId,
    customerIds: [...new Set(customerIds)],
  });

  return new Map(rows.map((row) => [row.id, row]));
}

async function getUsersByIds(_db: Database, teamId: string, assignedIds: string[]) {
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
    (await getTeamMembers(_db, teamId))
      .filter((member) => assignedIdSet.has(member.id))
      .map((member) => [
        member.id,
        {
          id: member.id,
          fullName: member.fullName,
          avatarUrl: member.avatarUrl,
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
  const projectIds = [...new Set(entries.map((entry) => entry.projectId).filter(isDefined))];
  const projects = await getTrackerProjectsByIdsFromD1(requireTrackerProjectsD1(db), {
    teamId,
    projectIds,
  });
  const customersById = await getCustomersByIds(
    db,
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
    trackerProject: entry.projectId ? (projectById.get(entry.projectId) ?? null) : null,
  }));
}
