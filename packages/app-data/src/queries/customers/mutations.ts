import {
  deleteCustomerInConvex,
  deleteCustomerTagsForCustomerInConvex,
  replaceCustomerTagsInConvex,
  toggleCustomerPortalInConvex,
  upsertCustomerInConvex,
} from "@tamias/app-data-convex";
import { generateToken } from "@tamias/invoice/token";
import type { Database } from "../../client";
import { createActivity } from "../activities";
import { getCustomerById } from "./reads";
import type {
  DeleteCustomerParams,
  ToggleCustomerPortalParams,
  UpsertCustomerParams,
} from "./types";

export const upsertCustomer = async (db: Database, params: UpsertCustomerParams) => {
  const { id, tags: inputTags, teamId, userId, ...rest } = params;
  const customerId = id ?? crypto.randomUUID();
  const isNewCustomer = !id;
  const token = await generateToken(customerId);
  const customer = await upsertCustomerInConvex({
    teamId,
    id: customerId,
    createdAt: isNewCustomer ? new Date().toISOString() : undefined,
    token,
    ...rest,
  });

  if (isNewCustomer) {
    createActivity(db, {
      teamId,
      userId,
      type: "customer_created",
      source: "user",
      priority: 7,
      metadata: {
        customerId,
        customerName: customer.name,
        customerEmail: customer.email,
        website: customer.website,
        country: customer.country,
        city: customer.city,
      },
    });
  }

  await replaceCustomerTagsInConvex({
    teamId,
    customerId,
    tagIds: inputTags?.map((tag) => tag.id) ?? [],
  });

  const result = await getCustomerById(db, { id: customerId, teamId });

  if (!result) {
    throw new Error("Failed to load customer after upsert");
  }

  return result;
};

export const deleteCustomer = async (db: Database, params: DeleteCustomerParams) => {
  const { id, teamId } = params;
  const customerToDelete = await getCustomerById(db, { id, teamId });

  if (!customerToDelete) {
    throw new Error("Customer not found");
  }

  await deleteCustomerInConvex({
    teamId,
    customerId: id,
  });

  await deleteCustomerTagsForCustomerInConvex({
    teamId,
    customerId: id,
  });

  return customerToDelete;
};

export async function toggleCustomerPortal(_db: Database, params: ToggleCustomerPortalParams) {
  return toggleCustomerPortalInConvex({
    teamId: params.teamId,
    customerId: params.customerId,
    enabled: params.enabled,
  });
}
