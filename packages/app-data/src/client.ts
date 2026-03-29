declare const queryContextBrand: unique symbol;

export type Database = {
  readonly [queryContextBrand]: true;
};

export type TransactionClient = Database;
export type DatabaseOrTransaction = Database;
export type QueryClient = Database;

export const db = Object.freeze({}) as Database;
