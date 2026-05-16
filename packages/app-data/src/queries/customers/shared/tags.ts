import type { Database } from "../../../client";
import { getCustomerTagsByCustomerIdFromD1, requireCustomersD1 } from "../d1";
import type { CustomerTag } from "../types";

async function getCustomerTagsByCustomerId(db: Database, teamId: string, customerIds: string[]) {
  if (customerIds.length === 0) {
    return new Map<string, CustomerTag[]>();
  }

  return getCustomerTagsByCustomerIdFromD1(requireCustomersD1(db), {
    teamId,
    customerIds,
  });
}

export async function attachCustomerTags<T extends { id: string }>(
  db: Database,
  teamId: string,
  rows: T[],
): Promise<Array<T & { tags: CustomerTag[] }>> {
  if (rows.length === 0) {
    return [];
  }

  const tagsByCustomerId = await getCustomerTagsByCustomerId(
    db,
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
