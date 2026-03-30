import "server-only";

import { getCustomerPageSummary } from "@tamias/app-data/queries/customer-summary";
import {
  type GetCustomersParams,
  getCustomers,
} from "@tamias/app-data/queries/customers";
import { cache } from "react";
import { getCurrentSession, getRequestDb } from "./context";

const getCustomerSummaryLocally = cache(async () => {
  const [session, requestDb] = await Promise.all([
    getCurrentSession(),
    getRequestDb(),
  ]);

  if (!session?.teamId) {
    return {
      mostActiveClient: null,
      inactiveClientsCount: 0,
      topRevenueClient: null,
      newCustomersCount: 0,
    };
  }

  return getCustomerPageSummary(requestDb, {
    teamId: session.teamId,
  });
});

export const getCustomersLocally = cache(
  async (input: Omit<GetCustomersParams, "teamId"> = {}) => {
    const [session, requestDb] = await Promise.all([
      getCurrentSession(),
      getRequestDb(),
    ]);

    if (!session?.teamId) {
      return {
        meta: {
          cursor: null,
          hasPreviousPage: false,
          hasNextPage: false,
        },
        data: [],
      };
    }

    return getCustomers(requestDb, {
      teamId: session.teamId,
      ...input,
    });
  },
);

export const getMostActiveClientLocally = cache(async () => {
  return (await getCustomerSummaryLocally()).mostActiveClient;
});

export const getInactiveClientsCountLocally = cache(async () => {
  return (await getCustomerSummaryLocally()).inactiveClientsCount;
});

export const getTopRevenueClientLocally = cache(async () => {
  return (await getCustomerSummaryLocally()).topRevenueClient;
});

export const getNewCustomersCountLocally = cache(async () => {
  return (await getCustomerSummaryLocally()).newCustomersCount;
});
