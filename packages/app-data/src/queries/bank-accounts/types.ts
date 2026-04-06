import type { CurrentUserIdentityRecord } from "@tamias/app-data-convex";

export type ConvexUserId = CurrentUserIdentityRecord["convexId"];

export type CreateBankAccountParams = {
  name: string;
  currency?: string;
  teamId: string;
  userId: ConvexUserId;
  manual?: boolean;
};

export type UpdateBankAccountParams = {
  id: string;
  teamId: string;
  name?: string;
  type?: "depository" | "credit" | "other_asset" | "loan" | "other_liability";
  balance?: number;
  enabled?: boolean;
  currency?: string;
  baseBalance?: number;
  baseCurrency?: string;
};

export type GetBankAccountsParams = {
  teamId: string;
  enabled?: boolean;
  manual?: boolean;
};

export type GetBankAccountTeamIdParams = {
  id: string;
};

export type GetCashBalanceParams = {
  teamId: string;
  currency?: string;
};

export type GetNetPositionParams = {
  teamId: string;
  currency?: string;
};
