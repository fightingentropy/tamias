import {
  getCustomersByIdsFromConvex,
  getTagsByIdsFromConvex,
  getTeamMembersFromConvexIdentity,
  getTrackerEntriesByProjectIdsFromConvex,
  getTrackerProjectAssignmentsForProjectIdsFromConvex,
  type TrackerEntryRecord,
  type TrackerProjectRecord,
} from "../../convex";
import type { Database } from "../../client";
import { getTeamById } from "../index";
import type {
  AssignedUser,
  TrackerProjectListItem,
  TrackerProjectTag,
} from "./types";

function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
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

export async function enrichProjects(
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
    getAssignedUsersByProject(teamId, projectEntries),
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
