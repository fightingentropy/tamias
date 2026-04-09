import { bankingCache, CacheTTL } from "@tamias/cache/banking-cache";
import { formatISO, subDays } from "date-fns";
import {
  Configuration,
  type CountryCode,
  type ItemPublicTokenExchangeResponse,
  type LinkTokenCreateResponse,
  PlaidApi as PlaidBaseApi,
  PlaidEnvironments,
  Products,
  SandboxItemFireWebhookRequestWebhookCodeEnum,
  type Transaction,
  WebhookType,
} from "plaid";
import { env } from "../../env";
import type { ConnectionStatus, GetInstitutionsRequest } from "../../types";
import { PLAID_COUNTRIES } from "../../utils/countries";
import { ProviderError } from "../../utils/error";
import { logger } from "../../utils/logger";
import { paginate } from "../../utils/paginate";
import { withRateLimitRetry, withRetry } from "../../utils/retry";
import type {
  DisconnectAccountRequest,
  GetAccountBalanceRequest,
  GetAccountBalanceResponse,
  GetAccountsRequest,
  GetAccountsResponse,
  GetConnectionStatusRequest,
  GetStatusResponse,
  GetTransactionsRequest,
  GetTransactionsResponse,
  ItemPublicTokenExchangeRequest,
  LinkTokenCreateRequest,
} from "./types";
import { isError } from "./utils";

function resolvePlaidBasePath(): string {
  const tier = env.PLAID_ENVIRONMENT.trim().toLowerCase();

  if (tier === "production") {
    return PlaidEnvironments.production!;
  }

  return PlaidEnvironments.sandbox!
}

export class PlaidApi {
  #client: PlaidBaseApi;
  #clientId: string;
  #clientSecret: string;

  #countryCodes = PLAID_COUNTRIES as CountryCode[];

  constructor() {
    this.#clientId = env.PLAID_CLIENT_ID;
    this.#clientSecret = env.PLAID_SECRET;

    const configuration = new Configuration({
      basePath: resolvePlaidBasePath(),
      baseOptions: {
        headers: {
          "PLAID-CLIENT-ID": this.#clientId,
          "PLAID-SECRET": this.#clientSecret,
        },
      },
    });

    this.#client = new PlaidBaseApi(configuration);
  }

  #generateWebhookUrl(environment: "sandbox" | "production") {
    const apiUrl = process.env.TAMIAS_API_URL;

    if (apiUrl) {
      return new URL("/webhook/plaid", apiUrl).toString();
    }

    if (environment === "sandbox") {
      return "https://api-staging.tamias.xyz/webhook/plaid";
    }

    return "https://api.tamias.xyz/webhook/plaid";
  }

  async getHealthCheck() {
    try {
      const response = await fetch("https://status.plaid.com/api/v2/status.json");

      const data = (await response.json()) as GetStatusResponse;

      return data.status.indicator === "none" || data.status.indicator === "maintenance";
    } catch {
      return false;
    }
  }

  async getAccountBalance({
    accessToken,
    accountId,
  }: GetAccountBalanceRequest): Promise<GetAccountBalanceResponse | undefined> {
    try {
      const accounts = await withRateLimitRetry(() =>
        this.#client.accountsGet({
          access_token: accessToken,
          options: {
            account_ids: [accountId],
          },
        }),
      );

      const account = accounts.data.accounts.at(0);
      if (!account) return undefined;

      // Return both balances and type so provider can infer correct balance field
      return {
        balances: account.balances,
        type: account.type,
      };
    } catch (error) {
      const parsedError = isError(error);

      if (parsedError) {
        throw new ProviderError(parsedError);
      }
    }
  }

  async getAccounts({
    accessToken,
    institutionId,
  }: GetAccountsRequest): Promise<GetAccountsResponse | undefined> {
    try {
      const accounts = await withRateLimitRetry(() =>
        this.#client.accountsGet({
          access_token: accessToken,
        }),
      );

      const institution = await this.institutionsGetById(institutionId);

      return accounts.data.accounts.map((account) => ({
        ...account,
        institution: {
          id: institution.data.institution.institution_id,
          name: institution.data.institution.name,
        },
      }));
    } catch (error) {
      const parsedError = isError(error);

      if (parsedError) {
        throw new ProviderError(parsedError);
      }
    }
  }

  async getTransactions({
    accessToken,
    accountId,
    latest,
  }: GetTransactionsRequest): Promise<GetTransactionsResponse | undefined> {
    try {
      let transactions: Array<Transaction> = [];

      if (latest) {
        // Get transactions from the last 5 days using /transactions/get
        const { data } = await withRateLimitRetry(() =>
          this.#client.transactionsGet({
            access_token: accessToken,
            start_date: formatISO(subDays(new Date(), 5), {
              representation: "date",
            }),
            end_date: formatISO(new Date(), {
              representation: "date",
            }),
          }),
        );

        transactions = data.transactions;
      } else {
        // Get all transactions using /transactions/sync (retry if cursor invalidated mid-pagination).
        const maxSyncAttempts = 5;
        let syncAttempt = 0;

        while (syncAttempt < maxSyncAttempts) {
          syncAttempt += 1;
          let cursor: string | undefined;
          let hasMore = true;
          transactions = [];

          try {
            while (hasMore) {
              const { data } = await withRateLimitRetry(() =>
                this.#client.transactionsSync({
                  access_token: accessToken,
                  cursor,
                }),
              );

              transactions = transactions.concat(data.added);
              hasMore = data.has_more;
              cursor = data.next_cursor;
            }
            break;
          } catch (loopError) {
            const syncMutation = isError(loopError);
            if (
              syncMutation &&
              syncMutation.code === "TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION" &&
              syncAttempt < maxSyncAttempts
            ) {
              continue;
            }

            const parsedError = isError(loopError);
            if (parsedError) {
              throw new ProviderError(parsedError);
            }
            throw loopError;
          }
        }
      }

      // Plaid returns transactions for every account on the item; scope to this account.
      // Include pending: sandbox and fresh links often only have pending rows at first; dropping
      // them made initial sync report success while importing zero rows.
      return transactions.filter((transaction) => transaction.account_id === accountId);
    } catch (error) {
      const parsedError = isError(error);

      if (parsedError) {
        throw new ProviderError(parsedError);
      }
    }
  }

  async linkTokenCreate({
    userId,
    language = "en",
    accessToken,
    environment = "production",
  }: LinkTokenCreateRequest): Promise<import("axios").AxiosResponse<LinkTokenCreateResponse>> {
    return this.#client.linkTokenCreate({
      client_id: this.#clientId,
      secret: this.#clientSecret,
      client_name: "Tamias",
      products: [Products.Transactions],
      language,
      access_token: accessToken,
      country_codes: this.#countryCodes,
      webhook: this.#generateWebhookUrl(environment),
      transactions: {
        days_requested: 730,
      },
      user: {
        client_user_id: userId,
      },
    });
  }

  async institutionsGetById(institution_id: string) {
    return bankingCache.getOrSet(
      `plaid_institution_${institution_id}`,
      CacheTTL.TWENTY_FOUR_HOURS,
      () =>
        this.#client.institutionsGetById({
          institution_id,
          country_codes: this.#countryCodes,
          options: {
            include_auth_metadata: true,
          },
        }),
    );
  }

  async itemPublicTokenExchange({
    publicToken,
  }: ItemPublicTokenExchangeRequest): Promise<
    import("axios").AxiosResponse<ItemPublicTokenExchangeResponse>
  > {
    return this.#client.itemPublicTokenExchange({
      public_token: publicToken,
    });
  }

  /**
   * Sandbox-only: create a public token for an institution so local/dev seeds can skip Link UI.
   * Default Plaid test user is `user_good`; pass `user_transactions_dynamic` via `overrideUsername` when your institution supports it (often US items).
   */
  async sandboxPublicTokenCreate(args: {
    institutionId: string;
    overrideUsername?: string;
  }): Promise<string> {
    if (env.PLAID_ENVIRONMENT.trim().toLowerCase() !== "sandbox") {
      throw new Error(
        "sandboxPublicTokenCreate only works when PLAID_ENVIRONMENT=sandbox. Production Plaid has no sandbox token endpoint.",
      );
    }

    const { data } = await this.#client.sandboxPublicTokenCreate({
      institution_id: args.institutionId,
      initial_products: [Products.Transactions],
      options: {
        override_username: args.overrideUsername ?? "user_good",
        override_password: "pass_good",
      },
    });

    return data.public_token;
  }

  /** Sandbox-only: nudge transaction data generation for fresh Items (helps E2E). */
  async sandboxFireTransactionsDefaultUpdate(accessToken: string): Promise<void> {
    if (env.PLAID_ENVIRONMENT.trim().toLowerCase() !== "sandbox") {
      return;
    }

    await this.#client.sandboxItemFireWebhook({
      access_token: accessToken,
      webhook_type: WebhookType.Transactions,
      webhook_code: SandboxItemFireWebhookRequestWebhookCodeEnum.DefaultUpdate,
    });
  }

  async itemGet(accessToken: string) {
    const { data } = await this.#client.itemGet({
      access_token: accessToken,
    });

    return data.item;
  }

  async deleteAccounts({ accessToken }: DisconnectAccountRequest) {
    await this.#client.itemRemove({
      access_token: accessToken,
    });
  }

  async getInstitutions(params?: GetInstitutionsRequest) {
    const countryCode = params?.countryCode
      ? [params.countryCode as CountryCode]
      : this.#countryCodes;

    return bankingCache.getOrSet(
      `plaid_institutions_${params?.countryCode ?? "all"}`,
      CacheTTL.TWENTY_FOUR_HOURS,
      () =>
        paginate({
          delay: {
            milliseconds: 100,
            onDelay: (message) => logger.info(message),
          },
          pageSize: 500,
          fetchData: (offset, count) =>
            withRetry(() =>
              this.#client
                .institutionsGet({
                  country_codes: countryCode,
                  count,
                  offset,
                  options: {
                    include_optional_metadata: true,
                    products: [Products.Transactions],
                  },
                })
                .then(({ data }) => {
                  return data.institutions;
                }),
            ),
        }),
    );
  }

  async getConnectionStatus({
    accessToken,
  }: GetConnectionStatusRequest): Promise<ConnectionStatus> {
    try {
      await this.#client.accountsGet({
        access_token: accessToken,
      });

      return { status: "connected" };
    } catch (error) {
      const parsedError = isError(error);

      if (parsedError) {
        const providerError = new ProviderError(parsedError);

        if (providerError.code === "disconnected") {
          return { status: "disconnected" };
        }
      }

      logger.error("Plaid connection status check failed", {
        error: error instanceof Error ? error.message : String(error),
      });

      return { status: "connected" };
    }
  }
}
