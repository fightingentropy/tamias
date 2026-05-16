export type BankAccountType = "depository" | "credit" | "other_asset" | "loan" | "other_liability";
export type BankConnectionProvider = "truelayer";
export type BankConnectionStatus = "connected" | "disconnected" | "unknown";

export type AppUserId = string;

export type BankAccountConnectionRecord = {
  id: string;
  createdAt: string;
  institutionId: string;
  expiresAt: string | null;
  teamId: string;
  name: string;
  accessToken: string | null;
  logoUrl: string | null;
  provider: BankConnectionProvider;
  lastAccessed: string | null;
  referenceId: string | null;
  status: BankConnectionStatus | null;
  errorDetails: string | null;
  errorRetries: number | null;
  bankAccounts: BankAccountRecord[];
};

export type BankAccountRecord = {
  id: string;
  createdAt: string;
  createdBy: AppUserId | null;
  teamId: string;
  name: string | null;
  currency: string | null;
  bankConnectionId: string | null;
  enabled: boolean;
  accountId: string;
  balance: number | null;
  manual: boolean;
  type: BankAccountType | null;
  baseCurrency: string | null;
  baseBalance: number | null;
  errorDetails: string | null;
  errorRetries: number | null;
  accountReference: string | null;
  iban: string | null;
  subtype: string | null;
  bic: string | null;
  routingNumber: string | null;
  wireRoutingNumber: string | null;
  accountNumber: string | null;
  sortCode: string | null;
  availableBalance: number | null;
  creditLimit: number | null;
  bankConnection?: BankAccountConnectionRecord | null;
};

export type CreateBankAccountParams = {
  name: string;
  currency?: string;
  teamId: string;
  userId: AppUserId;
  manual?: boolean;
};

export type UpdateBankAccountParams = {
  id: string;
  teamId: string;
  name?: string;
  type?: BankAccountType;
  balance?: number;
  enabled?: boolean;
  currency?: string;
  baseBalance?: number;
  baseCurrency?: string;
};

export type PatchBankAccountParams = UpdateBankAccountParams & {
  errorDetails?: string | null;
  errorRetries?: number | null;
  accountReference?: string | null;
  accountId?: string;
  iban?: string | null;
  subtype?: string | null;
  bic?: string | null;
  routingNumber?: string | null;
  wireRoutingNumber?: string | null;
  accountNumber?: string | null;
  sortCode?: string | null;
  availableBalance?: number | null;
  creditLimit?: number | null;
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
