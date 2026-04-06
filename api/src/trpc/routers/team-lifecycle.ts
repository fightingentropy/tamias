import { createHash } from "node:crypto";
import { upsertTransactionCategoriesInConvex } from "@tamias/app-data-convex";
import { createTeam, deleteTeam, getTeamById } from "@tamias/app-data/queries";
import { getBankConnections } from "@tamias/app-data/queries/bank-connections";
import {
  getTeamMembersFromConvex,
  hasTeamAccessInConvex,
  leaveTeamInConvex,
} from "@tamias/app-services/identity";
import { chatCache } from "@tamias/cache/chat-cache";
import { CATEGORIES, getTaxRateForCategory } from "@tamias/categories";
import { enqueue, startCloudflareWorkflow } from "@tamias/job-client";
import { TRPCError } from "@trpc/server";
import {
  createTeamSchema,
  deleteTeamSchema,
  leaveTeamSchema,
  startOnboardingWorkflowSchema,
} from "../../schemas/team";
import { protectedProcedure, publicProcedure } from "../init";
import {
  buildTeamSystemCategoryInputs,
  getTeamMemberRoleByConvexId,
  getTeamOwnerCount,
  requireTeamConvexUserId,
} from "./team-shared";

export const teamLifecycleProcedures = {
  startOnboardingWorkflow: publicProcedure
    .input(startOnboardingWorkflowSchema)
    .mutation(async ({ input }) => {
      return startCloudflareWorkflow(
        "onboard-team",
        {
          email: input.email,
        },
        {
          instanceId: buildOnboardingWorkflowInstanceId(input.email),
        },
      );
    }),

  create: protectedProcedure
    .input(createTeamSchema)
    .mutation(async ({ ctx: { db, session }, input }) => {
      let createdTeam: Awaited<ReturnType<typeof createTeam>>;

      try {
        createdTeam = await createTeam(db, {
          id: crypto.randomUUID(),
          ...input,
          userId: requireTeamConvexUserId(session),
          email: session.user.email!,
          companyType: input.companyType,
        });
      } catch (error) {
        if (error instanceof Error && error.message === "PAID_PLAN_REQUIRED") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "All existing teams must be on a paid plan before creating another",
          });
        }

        throw error;
      }

      const categoryCountryCode = createdTeam.countryCode ?? input.countryCode ?? null;
      const { parentCategories, taxType } = buildTeamSystemCategoryInputs(
        createdTeam.id,
        categoryCountryCode,
      );
      const insertedParents = await upsertTransactionCategoriesInConvex({
        teamId: createdTeam.id,
        categories: parentCategories,
      });
      const parentIdBySlug = new Map(insertedParents.map((parent) => [parent.slug, parent.id]));
      const childCategories = buildChildTeamSystemCategories({
        teamId: createdTeam.id,
        categoryCountryCode,
        taxType,
        parentIdBySlug,
      });

      if (childCategories.length > 0) {
        await upsertTransactionCategoriesInConvex({
          teamId: createdTeam.id,
          categories: childCategories,
        });
      }

      return createdTeam.id;
    }),

  leave: protectedProcedure.input(leaveTeamSchema).mutation(async ({ ctx: { session }, input }) => {
    const teamMembers = await getTeamMembersFromConvex(input.teamId);
    const currentUserRole = getTeamMemberRoleByConvexId(teamMembers, session.user.id);

    if (currentUserRole === "owner" && getTeamOwnerCount(teamMembers) === 1) {
      throw Error("Action not allowed");
    }

    return leaveTeamInConvex({
      publicTeamId: input.teamId,
      userId: session.user.convexId,
      email: session.user.email ?? null,
    });
  }),

  delete: protectedProcedure
    .input(deleteTeamSchema)
    .mutation(async ({ ctx: { db, session }, input }) => {
      const canAccess = await hasTeamAccessInConvex({
        userId: session.user.convexId,
        email: session.user.email ?? null,
        publicTeamId: input.teamId,
      });

      if (!canAccess) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this team",
        });
      }

      const team = await getTeamById(db, input.teamId);

      if (!team) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Team not found",
        });
      }

      const bankConnections = await getBankConnections(db, {
        teamId: input.teamId,
      });

      await enqueue(
        "delete-team",
        {
          teamId: input.teamId!,
          connections: bankConnections.map((c) => ({
            referenceId: c.referenceId,
            provider: c.provider,
            accessToken: c.accessToken,
          })),
        },
        "teams",
        {
          publicTeamId: input.teamId!,
          appUserId: session.user.convexId,
        },
      );

      const data = await deleteTeam(db, {
        teamId: input.teamId,
      });

      if (!data) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete team",
        });
      }

      try {
        await Promise.all([
          chatCache.invalidateTeamContext(input.teamId),
          ...data.memberUserIds.map((userId) =>
            chatCache.invalidateUserContext(userId, input.teamId),
          ),
        ]);
      } catch {
        // Non-fatal; team deletion already succeeded.
      }
    }),
};

function buildChildTeamSystemCategories(args: {
  teamId: string;
  categoryCountryCode: string | null;
  taxType: ReturnType<typeof buildTeamSystemCategoryInputs>["taxType"];
  parentIdBySlug: Map<string, string>;
}) {
  return CATEGORIES.flatMap((parent) => {
    const parentId = args.parentIdBySlug.get(parent.slug);

    if (!parentId) {
      return [];
    }

    return parent.children.map((child) => {
      const taxRate = getTaxRateForCategory(args.categoryCountryCode, child.slug);

      return {
        teamId: args.teamId,
        name: child.name,
        slug: child.slug,
        color: child.color,
        system: child.system,
        excluded: child.excluded,
        taxRate: taxRate > 0 ? taxRate : null,
        taxType: taxRate > 0 ? args.taxType : null,
        taxReportingCode: null,
        description: null,
        parentId,
      };
    });
  });
}

function buildOnboardingWorkflowInstanceId(email: string) {
  return `onboard-team-${createHash("sha256").update(email).digest("hex").slice(0, 24)}`;
}
