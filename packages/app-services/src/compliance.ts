import type { Database } from "@tamias/app-data/client";
import {
  getFilingProfile,
  getVatDashboard,
  listVatSubmissions,
} from "@tamias/app-data/queries/compliance";
import { getPayrollDashboard } from "@tamias/app-data/queries/payroll";
import { getYearEndDashboard } from "@tamias/app-data/queries/year-end";

export async function getComplianceProfileForTeam(args: {
  db: Database;
  teamId: string;
}) {
  return getFilingProfile(args.db, args.teamId);
}

export async function getVatDashboardForTeam(args: {
  db: Database;
  teamId: string;
}) {
  return getVatDashboard(args.db, {
    teamId: args.teamId,
  });
}

export async function getVatSubmissionsForTeam(args: {
  db: Database;
  teamId: string;
}) {
  return listVatSubmissions(args.db, {
    teamId: args.teamId,
  });
}

export async function getYearEndDashboardForTeam(args: {
  db: Database;
  teamId: string;
}) {
  return getYearEndDashboard(args.db, {
    teamId: args.teamId,
  });
}

export async function getPayrollDashboardForTeam(args: {
  db: Database;
  teamId: string;
}) {
  return getPayrollDashboard(args.db, {
    teamId: args.teamId,
  });
}
