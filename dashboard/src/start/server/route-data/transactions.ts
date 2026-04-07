import { loadTransactionTab } from "@/hooks/use-transaction-tab";
import { getInitialTableSettings } from "@/utils/columns";
import {
  buildShellOnlyPageData,
  getRequestUrl,
} from "@/start/server/route-data/shared";

export async function buildTransactionsPageData(href?: string) {
  const result = await buildShellOnlyPageData();
  const requestUrl = getRequestUrl(href);
  const { tab } = loadTransactionTab(requestUrl.searchParams);
  const initialSettings = await getInitialTableSettings("transactions");

  return {
    ...result,
    initialSettings,
    initialTab: tab,
  };
}

export async function buildTransactionCategoriesPageData() {
  return buildShellOnlyPageData();
}
