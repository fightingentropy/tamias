export type TellerMtlsFetcher = {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
};

type BankingRuntimeConfig = {
  tellerMtlsFetcher?: TellerMtlsFetcher;
};

const runtimeConfig: BankingRuntimeConfig = {};

export function configureBankingRuntime(config: BankingRuntimeConfig) {
  runtimeConfig.tellerMtlsFetcher = config.tellerMtlsFetcher;
}

export function getBankingRuntime() {
  return runtimeConfig;
}
