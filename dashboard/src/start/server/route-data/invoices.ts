import { getInitialTableSettings } from "@/utils/columns";
import { buildShellOnlyPageData } from "@/start/server/route-data/shared";

export async function buildInvoicesPageData(_href?: string) {
  const result = await buildShellOnlyPageData();
  const initialSettings = await getInitialTableSettings("invoices");

  return {
    ...result,
    initialSettings,
  };
}

export async function buildInvoiceProductsPageData() {
  return buildShellOnlyPageData();
}
