import type { Database } from "../../client";
import { getCustomerPageSummary } from "../customer-summary";
import type {
  GetNewCustomersCountParams,
  GetTopRevenueClientParams,
} from "./shared";

export async function getTopRevenueClient(
  _db: Database,
  params: GetTopRevenueClientParams,
) {
  return (await getCustomerPageSummary(_db, params)).topRevenueClient;
}

export async function getNewCustomersCount(
  _db: Database,
  params: GetNewCustomersCountParams,
) {
  return (await getCustomerPageSummary(_db, params)).newCustomersCount;
}
