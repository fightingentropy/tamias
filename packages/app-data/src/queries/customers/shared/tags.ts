import {
  getCustomerTagAssignmentsForCustomerIdsFromConvex,
  getTagsByIdsFromConvex,
  type CustomerTagAssignmentRecord,
} from "@tamias/app-data-convex";
import type { CustomerTag } from "../types";

function groupCustomerTagAssignmentsByCustomerId(assignments: CustomerTagAssignmentRecord[]) {
  const assignmentsByCustomerId = new Map<string, CustomerTagAssignmentRecord[]>();

  for (const assignment of assignments) {
    const current = assignmentsByCustomerId.get(assignment.customerId) ?? [];
    current.push(assignment);
    assignmentsByCustomerId.set(assignment.customerId, current);
  }

  return assignmentsByCustomerId;
}

async function getCustomerTagsByCustomerId(teamId: string, customerIds: string[]) {
  if (customerIds.length === 0) {
    return new Map<string, CustomerTag[]>();
  }

  const assignments = await getCustomerTagAssignmentsForCustomerIdsFromConvex({
    teamId,
    customerIds,
  });

  if (assignments.length === 0) {
    return new Map<string, CustomerTag[]>();
  }

  const assignmentsByCustomerId = groupCustomerTagAssignmentsByCustomerId(assignments);
  const tagIds = [...new Set(assignments.map((assignment) => assignment.tagId))];
  const tagRows = await getTagsByIdsFromConvex({
    teamId,
    tagIds,
  });
  const tagNameById = new Map(tagRows.map((tag) => [tag.id, tag.name]));
  const tagsByCustomerId = new Map<string, CustomerTag[]>();

  for (const [customerId, customerAssignments] of assignmentsByCustomerId) {
    const customerTags = customerAssignments
      .map((assignment) => {
        const name = tagNameById.get(assignment.tagId);

        if (!name) {
          return null;
        }

        return {
          id: assignment.tagId,
          name,
        };
      })
      .filter((tag): tag is CustomerTag => tag !== null)
      .sort((left, right) => left.name.localeCompare(right.name));

    tagsByCustomerId.set(customerId, customerTags);
  }

  return tagsByCustomerId;
}

export async function attachCustomerTags<T extends { id: string }>(
  teamId: string,
  rows: T[],
): Promise<Array<T & { tags: CustomerTag[] }>> {
  if (rows.length === 0) {
    return [];
  }

  const tagsByCustomerId = await getCustomerTagsByCustomerId(
    teamId,
    rows.map((row) => row.id),
  );

  return rows.map((row) => ({
    ...row,
    tags: tagsByCustomerId.get(row.id) ?? [],
  }));
}

export function compareCustomersByTags(
  left: { tags: CustomerTag[]; createdAt: string },
  right: { tags: CustomerTag[]; createdAt: string },
  isAscending: boolean,
) {
  const leftTag = left.tags[0]?.name;
  const rightTag = right.tags[0]?.name;

  if (!leftTag && !rightTag) {
    return right.createdAt.localeCompare(left.createdAt);
  }

  if (!leftTag) {
    return isAscending ? 1 : -1;
  }

  if (!rightTag) {
    return isAscending ? -1 : 1;
  }

  const delta = leftTag.localeCompare(rightTag);

  if (delta !== 0) {
    return isAscending ? delta : -delta;
  }

  return right.createdAt.localeCompare(left.createdAt);
}
