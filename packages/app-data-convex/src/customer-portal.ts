import { api, createClient, serviceArgs } from "./base";
import type { CustomerRecord } from "./customer-records";

export async function toggleCustomerPortalInConvex(args: {
  teamId: string;
  customerId: string;
  enabled: boolean;
}) {
  return createClient().mutation(
    api.customers.serviceToggleCustomerPortal,
    serviceArgs({
      teamId: args.teamId,
      customerId: args.customerId,
      enabled: args.enabled,
    }),
  ) as Promise<{
    id: string;
    portalEnabled: boolean;
    portalId: string | null;
  }>;
}

export async function getCustomerByPortalIdFromConvex(args: { portalId: string }) {
  return createClient().query(
    api.customers.serviceGetCustomerByPortalId,
    serviceArgs({
      portalId: args.portalId,
    }),
  ) as Promise<CustomerRecord | null>;
}
