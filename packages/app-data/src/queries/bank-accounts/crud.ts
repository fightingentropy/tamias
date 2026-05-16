import { nanoid } from "nanoid";
import type { Database } from "../../client";
import {
  createBankAccountInD1,
  deleteBankAccountFromD1,
  getBankAccountByIdFromD1,
  patchBankAccountInD1,
  requireBankAccountsD1,
} from "./d1";
import type {
  CreateBankAccountParams,
  PatchBankAccountParams,
  UpdateBankAccountParams,
} from "./types";

type DeleteBankAccountParams = {
  id: string;
  teamId: string;
};

export async function createBankAccount(db: Database, params: CreateBankAccountParams) {
  return createBankAccountInD1(requireBankAccountsD1(db), {
    ...params,
    accountId: nanoid(),
  });
}

export async function deleteBankAccount(db: Database, params: DeleteBankAccountParams) {
  const d1 = requireBankAccountsD1(db);
  const deleted = await getBankAccountByIdFromD1(d1, params);

  if (deleted) {
    await deleteBankAccountFromD1(d1, params);
  }

  return deleted;
}

export async function updateBankAccount(db: Database, params: UpdateBankAccountParams) {
  return patchBankAccountInD1(requireBankAccountsD1(db), params);
}

export async function patchBankAccount(db: Database, params: PatchBankAccountParams) {
  return patchBankAccountInD1(requireBankAccountsD1(db), params);
}
