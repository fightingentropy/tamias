import type { Database } from "../../../client";
import { countCustomersCreatedBetween } from "../../customer-activity-shared";
import type { GetInsightActivityDataParams } from "./types";

type CustomerActivityStats = {
  newCount: number;
};

export async function getCustomerActivityStats(
  db: Database,
  params: GetInsightActivityDataParams,
): Promise<CustomerActivityStats> {
  const { teamId, from, to } = params;

  return {
    newCount: await countCustomersCreatedBetween({
      db,
      teamId,
      from,
      to,
    }),
  };
}
