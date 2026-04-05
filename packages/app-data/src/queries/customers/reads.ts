import {
  getCustomerByIdFromConvex,
  getCustomersFromConvex,
} from "../../convex";
import type { Database } from "../../client";
import {
  buildCustomerRows,
  canUseIndexedCustomerPage,
  getIndexedCustomersPage,
  matchesCustomerSearch,
  sortCustomers,
} from "./shared";
import type { GetCustomerByIdParams, GetCustomersParams } from "./types";

export const getCustomerById = async (
  _db: Database,
  params: GetCustomerByIdParams,
) => {
  const customer = await getCustomerByIdFromConvex({
    teamId: params.teamId,
    customerId: params.id,
  });

  if (!customer) {
    return null;
  }

  const [customerWithTags] = await buildCustomerRows(params.teamId, [customer]);

  return customerWithTags ?? null;
};

export const getCustomers = async (
  _db: Database,
  params: GetCustomersParams,
) => {
  const { teamId, sort, cursor, pageSize = 25, q } = params;

  if (canUseIndexedCustomerPage(sort)) {
    return getIndexedCustomersPage(params);
  }

  const offset = cursor ? Number.parseInt(cursor, 10) : 0;
  const customers = await getCustomersFromConvex({ teamId });
  const matchedCustomers = customers.filter((customer) =>
    matchesCustomerSearch(customer, q),
  );
  const dataWithTags = await buildCustomerRows(teamId, matchedCustomers);
  const sortedData = sortCustomers(dataWithTags, sort);
  const paginatedData = sortedData.slice(offset, offset + pageSize);
  const nextCursor =
    sortedData.length > offset + pageSize
      ? (offset + pageSize).toString()
      : undefined;

  return {
    meta: {
      cursor: nextCursor ?? null,
      hasPreviousPage: offset > 0,
      hasNextPage: sortedData.length > offset + pageSize,
    },
    data: paginatedData,
  };
};
