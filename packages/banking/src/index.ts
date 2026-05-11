import { TrueLayerProvider } from "./providers/truelayer/truelayer-provider";
import type {
  DeleteAccountsRequest,
  DeleteConnectionRequest,
  GetAccountBalanceRequest,
  GetAccountsRequest,
  GetConnectionStatusRequest,
  GetHealthCheckResponse,
  GetInstitutionsRequest,
  GetTransactionsRequest,
  ProviderParams,
} from "./types";
import { logger } from "./utils/logger";

export class Provider {
  #name: string;

  #provider: TrueLayerProvider;

  constructor(params: ProviderParams) {
    this.#name = params.provider;

    switch (params.provider) {
      case "truelayer":
        this.#provider = new TrueLayerProvider();
        break;
      default: {
        const exhaustiveCheck: never = params.provider;
        throw new Error(`Unknown banking provider: ${exhaustiveCheck}`);
      }
    }
  }

  async getHealthCheck(): Promise<GetHealthCheckResponse> {
    const truelayer = new TrueLayerProvider();

    try {
      const isTrueLayerHealthy = await truelayer.getHealthCheck();

      return {
        truelayer: {
          healthy: isTrueLayerHealthy,
        },
      };
    } catch (error) {
      logger.error("Health check failed", { error });
      throw error;
    }
  }

  async getTransactions(params: GetTransactionsRequest) {
    logger.info("getTransactions", {
      provider: this.#name,
      accountId: params.accountId,
    });

    return this.#provider.getTransactions(params);
  }

  async getAccounts(params: GetAccountsRequest) {
    logger.info("getAccounts", { provider: this.#name });

    return this.#provider.getAccounts(params);
  }

  async getAccountBalance(params: GetAccountBalanceRequest) {
    logger.info("getAccountBalance", {
      provider: this.#name,
      accountId: params.accountId,
    });

    return this.#provider.getAccountBalance(params);
  }

  async getInstitutions(params: GetInstitutionsRequest) {
    logger.info("getInstitutions", { provider: this.#name });

    return this.#provider.getInstitutions(params);
  }

  async deleteAccounts(params: DeleteAccountsRequest) {
    logger.info("deleteAccounts", { provider: this.#name });

    return this.#provider.deleteAccounts(params);
  }

  async getConnectionStatus(params: GetConnectionStatusRequest) {
    logger.info("getConnectionStatus", { provider: this.#name });

    return this.#provider.getConnectionStatus(params);
  }

  async deleteConnection(params: DeleteConnectionRequest) {
    logger.info("deleteConnection", { provider: this.#name });

    return this.#provider.deleteConnection(params);
  }
}

export type { FetchInstitutionsResult, InstitutionRecord } from "./institutions";
export { fetchAllInstitutions } from "./institutions";
export { encodeTokenBlob as encodeTrueLayerTokens, TrueLayerApi } from "./providers/truelayer/truelayer-api";
export type { TrueLayerTokens } from "./providers/truelayer/types";
export { syncInstitutionLogos } from "./sync-logos";
// Re-export types, provider APIs, and institution sync
export type * from "./types";
export { createErrorResponse, getProviderErrorDetails, ProviderError } from "./utils/error";
export { getFileExtension, getLogoURL } from "./utils/logo";
export { getRates } from "./utils/rates";
