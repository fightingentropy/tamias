
import {
  type GetInvoiceProductsParams,
  getInvoiceProducts,
} from "@tamias/app-data/queries/invoice-products";
import { cache } from "react";
import { getCurrentSession } from "./context";

export const getInvoiceProductsLocally = cache(
  async (input?: GetInvoiceProductsParams) => {
    const session = await getCurrentSession();

    if (!session?.teamId) {
      return [];
    }

    return getInvoiceProducts(session.teamId, input);
  },
);
