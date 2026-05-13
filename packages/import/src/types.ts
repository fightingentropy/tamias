export type Transaction = {
  date: string;
  description?: string;
  counterparty?: string;
  balance?: string;
  duplicateIndex?: number;
  amount: string;
  teamId: string;
  bankAccountId: string;
  currency: string;
};
