import type { Database } from "../../client";
import { buildCustomerRows, sortCustomers } from "./shared";
import { getCustomerByIdFromD1, getCustomersFromD1, requireCustomersD1 } from "./d1";
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
  const customers = await getCustomersFromD1(requireCustomersD1(db), { teamId, q, sort });
  const dataWithTags = await buildCustomerRows(db, teamId, customers);
  const sortedData = sortCustomers(dataWithTags, sort);
  const paginatedData = sortedData.slice(offset, offset + pageSize);
  const nextCursor =
    sortedData.length > offset + pageSize ? (offset + pageSize).toString() : undefined;

  return {
    meta: {
      cursor: nextCursor ?? null,
      hasPreviousPage: offset > 0,
      hasNextPage: sortedData.length > offset + pageSize,
    },
    data: paginatedData,
  };
};
