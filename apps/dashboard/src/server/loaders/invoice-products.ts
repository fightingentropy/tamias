import "server-only";

import { getInvoiceProductsForTeam } from "@tamias/app-services/invoice-products";
import type { GetInvoiceProductsParams } from "@tamias/app-data/queries/invoice-products";
import { cache } from "react";
import { getCurrentSession } from "./context";

export const getInvoiceProductsLocally = cache(
  async (input?: GetInvoiceProductsParams) => {
    const session = await getCurrentSession();

    if (!session?.teamId) {
      return [];
    }

    return getInvoiceProductsForTeam({
      teamId: session.teamId,
      input,
    });
  },
);
