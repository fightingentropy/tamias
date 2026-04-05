import type { DatabaseOrTransaction } from "../../client";
import { getInvoiceById as getInvoiceByIdImpl } from "./reads-shared";
import type { GetInvoiceByIdParams } from "./types";

export async function getInvoiceById(
  _db: DatabaseOrTransaction,
  params: GetInvoiceByIdParams,
) {
  return getInvoiceByIdImpl(params);
}
