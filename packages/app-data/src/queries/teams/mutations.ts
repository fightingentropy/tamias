import {
  createTeamForUserInConvexIdentity,
  deleteTeamByIdInConvexIdentity,
  type UpdateTeamInConvexIdentityInput,
  updateTeamByIdInConvexIdentity,
} from "@tamias/app-data-convex";
import type { Database } from "../../client";
import type { ConvexUserId } from "./shared";
import { getTeamMembers } from "./reads";

type UpdateTeamParams = {
  id: string;
  data: Omit<UpdateTeamInConvexIdentityInput, "teamId">;
};

export const updateTeamById = async (
  _db: Database,
  params: UpdateTeamParams,
) => {
  const { id, data } = params;

  return updateTeamByIdInConvexIdentity({
    teamId: id,
    ...data,
  });
};

type CreateTeamParams = {
  id?: string;
  name: string;
  userId: ConvexUserId;
  email: string;
  baseCurrency?: string;
  countryCode?: string;
  fiscalYearStartMonth?: number | null;
  logoUrl?: string;
  companyType?: string;
  heardAbout?: string;
  switchTeam?: boolean;
};

export const createTeam = async (_db: Database, params: CreateTeamParams) => {
  const team = await createTeamForUserInConvexIdentity({
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
  const teamMembers = await getTeamMembers(_db, params.teamId);

  const result = await deleteTeamByIdInConvexIdentity({
    teamId: params.teamId,
  });

  if (!result) {
    return null;
  }

  return {
    ...result,
    memberUserIds: teamMembers.map((member) => member.id),
  };
}
