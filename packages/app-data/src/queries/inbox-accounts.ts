import {
  deleteInboxAccountInConvex,
  getInboxAccountByIdFromConvex,
  getInboxAccountInfoFromConvex,
  getInboxAccountsFromConvex,
  upsertInboxAccountInConvex,
  updateInboxAccountInConvex,
} from "@tamias/app-data-convex";

async function getInboxAccountsImpl(teamId: string) {
  return getInboxAccountsFromConvex({ teamId });
}

export async function getInboxAccounts(teamId: string) {
  return getInboxAccountsImpl(teamId);
}

type GetInboxAccountByIdParams = {
  id: string;
  teamId: string;
};

async function getInboxAccountByIdImpl(params: GetInboxAccountByIdParams) {
  return getInboxAccountByIdFromConvex({
    id: params.id,
    teamId: params.teamId,
  });
}

export async function getInboxAccountById(params: GetInboxAccountByIdParams) {
  return getInboxAccountByIdImpl(params);
}

type DeleteInboxAccountParams = {
  id: string;
  teamId: string;
};

export async function deleteInboxAccount(params: DeleteInboxAccountParams) {
  return deleteInboxAccountInConvex({
    id: params.id,
    teamId: params.teamId,
  });
}

export type UpdateInboxAccountParams = {
  id: string;
  refreshToken?: string;
  accessToken?: string;
  expiryDate?: string;
  scheduleId?: string;
  lastAccessed?: string;
  status?: "connected" | "disconnected";
  errorMessage?: string | null;
};

export async function updateInboxAccount(params: UpdateInboxAccountParams) {
  return updateInboxAccountInConvex(params);
}

export type UpsertInboxAccountParams = {
  teamId: string;
  provider: "gmail" | "outlook";
  accessToken: string;
  refreshToken: string;
  email: string;
  lastAccessed: string;
  externalId: string;
  expiryDate: string;
};

export async function upsertInboxAccount(params: UpsertInboxAccountParams) {
  return upsertInboxAccountInConvex(params);
}

type GetInboxAccountInfoParams = {
  id: string;
};

export async function getInboxAccountInfo(params: GetInboxAccountInfoParams) {
  return getInboxAccountInfoFromConvex({
    id: params.id,
  });
}
