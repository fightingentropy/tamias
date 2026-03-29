import "server-only";

import { getInvoiceByToken } from "@tamias/app-services/invoice-by-token";
import {
  getCustomerPortalData,
  getCustomerPortalInvoicesPage,
  getPublicReportByLinkId,
  getPublicReportChartDataByLinkId,
  getPublicShortLink,
} from "@tamias/app-services/public-reads";
import type { GetCustomerPortalInvoicesParams } from "@tamias/app-data/queries/customers";
import { cache } from "react";
import { measureServerRead } from "@/server/perf";
import { getRequestDb } from "./context";
import type {
  LocalInvoiceByToken,
  LocalPortalData,
  LocalPortalInvoices,
  LocalReportByLinkId,
  LocalReportChartData,
  LocalShortLink,
} from "./types";

export const getInvoiceByTokenLocally = cache(
  async (token: string): Promise<LocalInvoiceByToken> => {
    return measureServerRead("getInvoiceByTokenLocally", () =>
      getInvoiceByToken(token),
    );
  },
);

export const getCustomerPortalDataLocally = cache(
  async (portalId: string): Promise<LocalPortalData> => {
    return measureServerRead("getCustomerPortalDataLocally", async () => {
      const requestDb = await getRequestDb();
      return getCustomerPortalData({
        db: requestDb,
        portalId,
      });
    });
  },
);

export const getCustomerPortalInvoicesLocally = cache(
  async (
    portalId: string,
    cursor?: GetCustomerPortalInvoicesParams["cursor"],
    pageSize?: GetCustomerPortalInvoicesParams["pageSize"],
  ): Promise<LocalPortalInvoices> => {
    return measureServerRead("getCustomerPortalInvoicesLocally", async () => {
      const requestDb = await getRequestDb();
      return getCustomerPortalInvoicesPage({
        db: requestDb,
        portalId,
        cursor,
        pageSize,
      });
    });
  },
);

export const getReportByLinkIdLocally = cache(
  async (linkId: string): Promise<LocalReportByLinkId> => {
    return measureServerRead("getReportByLinkIdLocally", async () => {
      const requestDb = await getRequestDb();

      return getPublicReportByLinkId({
        db: requestDb,
        linkId,
      });
    });
  },
);

export const getShortLinkLocally = cache(
  async (shortId: string): Promise<LocalShortLink> => {
    return measureServerRead("getShortLinkLocally", async () => {
      const requestDb = await getRequestDb();

      return getPublicShortLink({
        db: requestDb,
        shortId,
      });
    });
  },
);

export const getReportChartDataByLinkIdLocally = cache(
  async (linkId: string): Promise<LocalReportChartData> => {
    return measureServerRead("getReportChartDataByLinkIdLocally", async () => {
      const requestDb = await getRequestDb();

      return getPublicReportChartDataByLinkId({
        db: requestDb,
        linkId,
      });
    });
  },
);
