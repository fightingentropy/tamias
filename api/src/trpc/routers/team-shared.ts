import type { getTeamMembersFromConvex } from "@tamias/app-services/identity";
import type { Session } from "@tamias/auth-session";
import {
  CATEGORIES,
  getTaxRateForCategory,
  getTaxTypeForCountry,
} from "@tamias/categories";

type TeamMembers = Awaited<ReturnType<typeof getTeamMembersFromConvex>>;

export function getTeamMemberRoleByPublicId(
  teamMembers: TeamMembers,
  userId: string,
) {
  return teamMembers.find((member) => member.user?.id === userId)?.role ?? null;
}

export function getTeamMemberByPublicId(
  teamMembers: TeamMembers,
  userId: string,
) {
  return teamMembers.find((member) => member.user?.id === userId) ?? null;
}

export function getTeamMemberRoleByConvexId(
  teamMembers: TeamMembers,
  userId: string,
) {
  return (
    teamMembers.find((member) => member.user?.convexId === userId)?.role ?? null
  );
}

export function getTeamOwnerCount(teamMembers: TeamMembers) {
  return teamMembers.filter((member) => member.role === "owner").length;
}

export function buildTeamSystemCategoryInputs(
  teamId: string,
  countryCode: string | null | undefined,
) {
  const taxType = getTaxTypeForCountry(countryCode);

  const parentCategories = CATEGORIES.map((parent) => {
    const taxRate = getTaxRateForCategory(countryCode, parent.slug);

    return {
      teamId,
      name: parent.name,
      slug: parent.slug,
      color: parent.color,
      system: parent.system,
      excluded: parent.excluded,
      taxRate: taxRate > 0 ? taxRate : null,
      taxType: taxRate > 0 ? taxType : null,
      taxReportingCode: null,
      description: null,
      parentId: null,
    };
  });

  return { parentCategories, taxType };
}

export function requireTeamConvexUserId(session: Session) {
  if (!session.user.convexId) {
    throw new Error("Missing Convex user id");
  }

  return session.user.convexId;
}
