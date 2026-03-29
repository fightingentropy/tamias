import "server-only";

import {
  getInvoicePaymentStatusForTeam,
  getInvoicesPage,
  getInvoiceSummaryForTeam,
} from "@tamias/app-services/invoices";
import type {
  GetInvoiceSummaryParams,
  GetInvoicesParams,
} from "@tamias/app-data/queries/invoices";
import { cache } from "react";
import { getCurrentSession, getRequestDb } from "./context";

export const getInvoiceListLocally = cache(
  async (input: Omit<GetInvoicesParams, "teamId"> = {}) => {
    const [session, requestDb] = await Promise.all([
      getCurrentSession(),
      getRequestDb(),
    ]);

    if (!session?.teamId) {
      return {
        meta: {
          cursor: null,
          hasPreviousPage: false,
          hasNextPage: false,
        },
        data: [],
      };
    }

    return getInvoicesPage({
      db: requestDb,
      teamId: session.teamId,
      input,
    });
  },
);

export const getInvoiceSummaryLocally = cache(
  async (statuses?: GetInvoiceSummaryParams["statuses"]) => {
    const [session, requestDb] = await Promise.all([
      getCurrentSession(),
      getRequestDb(),
    ]);

    if (!session?.teamId) {
      return {
        totalAmount: 0,
        invoiceCount: 0,
        currency: "USD",
      };
    }

    return getInvoiceSummaryForTeam({
      db: requestDb,
      teamId: session.teamId,
      statuses,
    });
  },
);

export const getInvoicePaymentStatusLocally = cache(async () => {
  const [session, requestDb] = await Promise.all([
    getCurrentSession(),
    getRequestDb(),
  ]);

  if (!session?.teamId) {
    return {
      score: 0,
      paymentStatus: "none" as const,
    };
  }

  return getInvoicePaymentStatusForTeam({
    db: requestDb,
    teamId: session.teamId,
  });
});
