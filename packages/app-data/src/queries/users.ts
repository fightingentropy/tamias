import type { QueryClient } from "../client";
import {
  deleteUserFromD1,
  getUserByEmailFromD1,
  getUserByIdFromD1,
  requireIdentityD1,
  updateUserInD1,
  type UpdateUserD1Input,
} from "./identity/d1";
import type { CurrentUserIdentityRecord } from "./teams/shared";

type UserId = CurrentUserIdentityRecord["id"];

export const getUserById = async (db: QueryClient, id: UserId) => {
  return getUserByIdFromD1(requireIdentityD1(db), id);
};

export const getUserByEmail = async (db: QueryClient, email: string) => {
  return getUserByEmailFromD1(requireIdentityD1(db), email);
};

export type UpdateUserParams = Omit<UpdateUserD1Input, "userId" | "currentEmail"> & {
  id: UserId;
};

export const updateUser = async (db: QueryClient, data: UpdateUserParams) => {
  const { id, ...updateData } = data;

  return updateUserInD1(requireIdentityD1(db), {
    userId: id,
    ...updateData,
  });
};

export const getUserTeamId = async (db: QueryClient, userId: UserId) => {
  const user = await getUserByIdFromD1(requireIdentityD1(db), userId);

  return user?.teamId ?? null;
};

export const deleteUser = async (db: QueryClient, id: UserId) => {
  return deleteUserFromD1(requireIdentityD1(db), id);
};
