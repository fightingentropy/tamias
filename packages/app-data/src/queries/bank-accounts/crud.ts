import {
  createBankAccountInConvex,
  deleteBankAccountInConvex,
  updateBankAccountInConvex,
} from "@tamias/app-data-convex";
import { nanoid } from "nanoid";
import type { Database } from "../../client";
import type {
  CreateBankAccountParams,
  UpdateBankAccountParams,
} from "./types";

type DeleteBankAccountParams = {
  id: string;
  teamId: string;
};

export async function createBankAccount(
  _db: Database,
  params: CreateBankAccountParams,
) {
  return createBankAccountInConvex({
    teamId: params.teamId,
    userId: params.userId,
    name: params.name,
    currency: params.currency,
    manual: params.manual,
    accountId: nanoid(),
    type: "depository",
  });
}

export async function deleteBankAccount(
  _db: Database,
  params: DeleteBankAccountParams,
) {
  return deleteBankAccountInConvex({
    id: params.id,
    teamId: params.teamId,
  });
}

export async function updateBankAccount(
  _db: Database,
  params: UpdateBankAccountParams,
) {
  const { id, teamId, ...data } = params;

  return updateBankAccountInConvex({
    id,
    teamId,
    name: data.name,
    type: data.type,
    balance: data.balance,
    enabled: data.enabled,
    currency: data.currency,
    baseBalance: data.baseBalance,
    baseCurrency: data.baseCurrency,
  });
}
