import { api, createClient, serviceArgs } from "./base";

export type CustomerTagAssignmentRecord = {
  customerId: string;
  tagId: string;
  teamId: string;
  createdAt: string;
  updatedAt: string;
};

export async function getCustomerTagAssignmentsForCustomerIdsFromConvex(args: {
  teamId: string;
  customerIds: string[];
}) {
  return createClient().query(
    api.customerTags.serviceGetCustomerTagAssignmentsForCustomerIds,
    serviceArgs({
      teamId: args.teamId,
      customerIds: args.customerIds,
    }),
  ) as Promise<CustomerTagAssignmentRecord[]>;
}

export async function replaceCustomerTagsInConvex(args: {
  teamId: string;
  customerId: string;
  tagIds: string[];
}) {
  return createClient().mutation(
    api.customerTags.serviceReplaceCustomerTags,
    serviceArgs({
      teamId: args.teamId,
      customerId: args.customerId,
      tagIds: args.tagIds,
    }),
  ) as Promise<CustomerTagAssignmentRecord[]>;
}

export async function deleteCustomerTagsForCustomerInConvex(args: {
  teamId: string;
  customerId: string;
}) {
  return createClient().mutation(
    api.customerTags.serviceDeleteCustomerTagsForCustomer,
    serviceArgs({
      teamId: args.teamId,
      customerId: args.customerId,
    }),
  ) as Promise<{ customerId: string }>;
}

export async function deleteCustomerTagsForTagInConvex(args: {
  teamId: string;
  tagId: string;
}) {
  return createClient().mutation(
    api.customerTags.serviceDeleteCustomerTagsForTag,
    serviceArgs({
      teamId: args.teamId,
      tagId: args.tagId,
    }),
  ) as Promise<{ tagId: string }>;
}
