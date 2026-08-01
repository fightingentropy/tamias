import { formatISO, subDays } from "date-fns";
import type { Provider } from "../../interface";
import type {
  DeleteAccountsRequest,
  DeleteConnectionRequest,
  GetAccountBalanceRequest,
  GetAccountsRequest,
  GetConnectionStatusRequest,
  GetInstitutionsRequest,
  GetTransactionsRequest,
} from "../../types";
import { TrueLayerApi } from "./truelayer-api";
import {
  transformAccount,
  transformAccountBalance,
  transformInstitution,
  transformTransaction,
} from "./transform";

function isCardAccountType(subtype?: string): boolean {
  if (!subtype) return false;
  return subtype.toLowerCase().includes("credit") || subtype.toLowerCase().includes("card");
}

export class TrueLayerProvider implements Provider {
  #api: TrueLayerApi;

  constructor() {
    this.#api = new TrueLayerApi();
  }

  async getHealthCheck() {
    return this.#api.getHealthCheck();
  }

  async getTransactions({ accessToken, accountId, accountType, latest }: GetTransactionsRequest) {
    if (!accessToken || !accountId) {
      throw Error("accessToken or accountId is missing");
    }

    const kind: "account" | "card" = accountType === "credit" ? "card" : "account";

    const to = formatISO(new Date(), { representation: "date" });
    const from = latest
      ? formatISO(subDays(new Date(), 5), { representation: "date" })
      : formatISO(subDays(new Date(), 730), { representation: "date" });

    const transactions =
      kind === "card"
        ? await this.#api.getCardTransactions(accessToken, accountId, { from, to })
        : await this.#api.getAccountTransactions(accessToken, accountId, { from, to });

    return transactions.map((transaction) =>
      transformTransaction({ transaction, accountType, kind }),
    );
  }

  async getAccounts({ accessToken }: GetAccountsRequest) {
    if (!accessToken) {
      throw Error("accessToken is missing");
    }

    const [accounts, cards] = await Promise.all([
      this.#api.getAccounts(accessToken),
      this.#api.getCards(accessToken).catch(() => []),
    ]);

    const accountsWithBalances = await Promise.all(
      accounts.map(async (account) => {
        const balance = await this.#api.getAccountBalance(accessToken, account.account_id);
        return transformAccount({ account, balance, kind: "account" });
      }),
    );

    const cardsWithBalances = await Promise.all(
      cards.map(async (card) => {
        const balance = await this.#api.getCardBalance(accessToken, card.account_id);
        return transformAccount({ account: card, balance, kind: "card" });
      }),
    );

    return [...accountsWithBalances, ...cardsWithBalances];
  }

  async getAccountBalance({ accessToken, accountId, accountType }: GetAccountBalanceRequest) {
    if (!accessToken || !accountId) {
      throw Error("Missing params");
    }

    const kind = isCardAccountType(accountType) ? "card" : "account";
    const balance =
      kind === "card"
        ? await this.#api.getCardBalance(accessToken, accountId)
        : await this.#api.getAccountBalance(accessToken, accountId);

    return transformAccountBalance({
      balance,
      accountType: kind === "card" ? "credit" : "depository",
    });
  }

  async getInstitutions(_params: GetInstitutionsRequest) {
    const providers = await this.#api.getProviders();
    return providers.map(transformInstitution);
  }

  async deleteAccounts({ accessToken }: DeleteAccountsRequest) {
    if (!accessToken) {
      throw Error("accessToken is missing");
    }
    await this.#api.revokeConnection(accessToken);
  }

  async getConnectionStatus({ accessToken }: GetConnectionStatusRequest) {
    if (!accessToken) {
      throw Error("accessToken is missing");
    }
    const status = await this.#api.getConnectionStatus(accessToken);
    return { status };
  }

  async deleteConnection({ accessToken }: DeleteConnectionRequest) {
    if (!accessToken) {
      throw Error("accessToken is missing");
    }
    await this.#api.revokeConnection(accessToken);
  }
}
