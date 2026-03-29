import "server-only";

import {
  getComplianceProfileForTeam,
  getPayrollDashboardForTeam,
  getVatDashboardForTeam,
  getVatSubmissionsForTeam,
  getYearEndDashboardForTeam,
} from "@tamias/app-services/compliance";
import { cache } from "react";
import { getCurrentSession, getRequestDb } from "./context";

export const getComplianceProfileLocally = cache(async () => {
  const [session, requestDb] = await Promise.all([
    getCurrentSession(),
    getRequestDb(),
  ]);

  if (!session?.teamId) {
    return null;
  }

  return getComplianceProfileForTeam({
    db: requestDb,
    teamId: session.teamId,
  });
});

export const getVatDashboardLocally = cache(async () => {
  const [session, requestDb] = await Promise.all([
    getCurrentSession(),
    getRequestDb(),
  ]);

  if (!session?.teamId) {
    return {
      enabled: false,
      team: {
        id: "",
        name: null,
        countryCode: null,
        baseCurrency: null,
      },
      profile: null,
      connected: false,
      obligations: [],
      latestDraft: null,
      latestSubmission: null,
    };
  }

  return getVatDashboardForTeam({
    db: requestDb,
    teamId: session.teamId,
  });
});

export const getVatSubmissionsLocally = cache(async () => {
  const [session, requestDb] = await Promise.all([
    getCurrentSession(),
    getRequestDb(),
  ]);

  if (!session?.teamId) {
    return [];
  }

  return getVatSubmissionsForTeam({
    db: requestDb,
    teamId: session.teamId,
  });
});

export const getYearEndDashboardLocally = cache(async () => {
  const [session, requestDb] = await Promise.all([
    getCurrentSession(),
    getRequestDb(),
  ]);

  if (!session?.teamId) {
    throw new Error("Team context is required for year-end dashboard");
  }

  return getYearEndDashboardForTeam({
    db: requestDb,
    teamId: session.teamId,
  });
});

export const getPayrollDashboardLocally = cache(async () => {
  const [session, requestDb] = await Promise.all([
    getCurrentSession(),
    getRequestDb(),
  ]);

  if (!session?.teamId) {
    throw new Error("Team context is required for payroll dashboard");
  }

  return getPayrollDashboardForTeam({
    db: requestDb,
    teamId: session.teamId,
  });
});
