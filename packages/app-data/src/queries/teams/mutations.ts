import type { Database } from "../../client";
import { rebuildDerivedComplianceJournalEntries } from "../compliance/ledger";
import {
  createTeamInD1,
  deleteTeamFromD1,
  requireIdentityD1,
  updateTeamInD1,
  type UpdateTeamD1Input,
} from "../identity/d1";
import type { UserId } from "./shared";

type UpdateTeamParams = {
  id: string;
  data: Omit<UpdateTeamD1Input, "teamId">;
};

export const updateTeamById = async (db: Database, params: UpdateTeamParams) => {
  const { id, data } = params;

  const team = await updateTeamInD1(requireIdentityD1(db), {
    teamId: id,
    ...data,
  });

  if (data.baseCurrency !== undefined || data.countryCode !== undefined) {
    await rebuildDerivedComplianceJournalEntries(db, {
      teamId: id,
    });
  }

  return team;
};

type CreateTeamParams = {
  id?: string;
  name: string;
  userId: UserId;
  email: string;
  baseCurrency?: string;
  countryCode?: string;
  fiscalYearStartMonth?: number | null;
  logoUrl?: string;
  companyType?: string;
  heardAbout?: string;
  switchTeam?: boolean;
};

export const createTeam = async (db: Database, params: CreateTeamParams) => {
  const team = await createTeamInD1(requireIdentityD1(db), {
    userId: params.userId,
    email: params.email,
    teamId: params.id,
    name: params.name,
    baseCurrency: params.baseCurrency,
    countryCode: params.countryCode,
    fiscalYearStartMonth: params.fiscalYearStartMonth,
    logoUrl: params.logoUrl,
    companyType: params.companyType,
    heardAbout: params.heardAbout,
    switchTeam: params.switchTeam,
  });

  if (!team) {
    throw new Error("Failed to create team.");
  }

  return team;
};

type DeleteTeamParams = {
  teamId: string;
};

export async function deleteTeam(_db: Database, params: DeleteTeamParams) {
  return deleteTeamFromD1(requireIdentityD1(_db), params.teamId);
}
