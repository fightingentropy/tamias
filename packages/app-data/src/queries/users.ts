import {
  deleteUserInConvexIdentity,
  getUserByEmailFromConvexIdentity,
  getUserByIdFromConvexIdentity,
  type CurrentUserIdentityRecord,
  type UpdateUserInConvexIdentityInput,
  updateUserInConvexIdentity,
} from "@tamias/app-data-convex";
import type { QueryClient } from "../client";

type ConvexUserId = CurrentUserIdentityRecord["convexId"];

export const getUserByConvexId = async (_db: QueryClient, id: ConvexUserId) => {
  return getUserByIdFromConvexIdentity({ userId: id });
};

export const getUserByEmail = async (_db: QueryClient, email: string) => {
  return getUserByEmailFromConvexIdentity({ email });
};

export type UpdateUserParams = Omit<UpdateUserInConvexIdentityInput, "userId" | "currentEmail"> & {
  id: ConvexUserId;
};

export const updateUser = async (_db: QueryClient, data: UpdateUserParams) => {
  const { id, ...updateData } = data;

  return updateUserInConvexIdentity({
    userId: id,
    ...updateData,
  });
};

export const getUserTeamId = async (_db: QueryClient, userId: ConvexUserId) => {
  const user = await getUserByIdFromConvexIdentity({ userId });

  return user?.teamId ?? null;
};

export const deleteUserByConvexId = async (_db: QueryClient, id: ConvexUserId) => {
  await deleteUserInConvexIdentity({ userId: id });
  return { id };
};
