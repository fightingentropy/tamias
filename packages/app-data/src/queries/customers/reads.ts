import type { Database } from "../../client";
import { buildCustomerRows } from "./shared";
import { getCustomerByIdFromD1, getCustomersPageFromD1, requireCustomersD1 } from "./d1";
import type { GetCustomerByIdParams, GetCustomersParams } from "./types";

export const getCustomerById = async (db: Database, params: GetCustomerByIdParams) => {
  const customer = await getCustomerByIdFromD1(requireCustomersD1(db), params);

  if (!customer) {
    return null;
  }

  const [customerWithTags] = await buildCustomerRows(db, params.teamId, [customer]);

  return customerWithTags ?? null;
};

export const getCustomers = async (db: Database, params: GetCustomersParams) => {
  const { teamId, sort, cursor, pageSize = 25, q } = params;
  const offset = cursor ? Number.parseInt(cursor, 10) : 0;
  const result = await getCustomersPageFromD1(requireCustomersD1(db), {
    teamId,
    cursor,
    pageSize,
    q,
    sort,
  });
  const dataWithTags = await buildCustomerRows(db, teamId, result.page);

  return {
    meta: {
      cursor: result.isDone ? null : result.continueCursor,
      hasPreviousPage: offset > 0,
      hasNextPage: !result.isDone,
    },
    data: dataWithTags,
  };
};
