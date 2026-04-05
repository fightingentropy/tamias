import type { Database } from "../../../client";
import { getCustomerPageSummary } from "../../customer-summary";

export type GetMostActiveClientParams = {
  teamId: string;
};

export async function getMostActiveClient(
  db: Database,
  params: GetMostActiveClientParams,
) {
  return (await getCustomerPageSummary(db, params)).mostActiveClient;
}

export type GetInactiveClientsCountParams = {
  teamId: string;
};

export async function getInactiveClientsCount(
  db: Database,
  params: GetInactiveClientsCountParams,
) {
  return (await getCustomerPageSummary(db, params)).inactiveClientsCount;
}
