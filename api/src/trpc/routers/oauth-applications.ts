import {
  createAuthorizationCodeInD1,
  createOAuthApplicationInD1,
  deleteOAuthApplicationInD1,
  getOAuthApplicationByClientIdFromD1,
  getOAuthApplicationByIdFromD1,
  getOAuthApplicationsByTeamFromD1,
  getOAuthTeamNameFromD1,
  getUserAuthorizedApplicationsFromD1,
  hasUserEverAuthorizedAppInD1,
  regenerateOAuthClientSecretInD1,
  revokeUserApplicationTokensInD1,
  updateOAuthApplicationInD1,
  updateOAuthApplicationStatusInD1,
} from "@tamias/app-services/oauth";
import { getOAuthApplicationInfo } from "@tamias/app-services/oauth-application-info";
import { sendEmail } from "@tamias/email/send";
import { createLoggerWithContext } from "@tamias/logger";
import { TRPCError } from "@trpc/server";
import { getSupportFromDisplay } from "@tamias/utils/envs";
import {
  authorizeOAuthApplicationSchema,
  createOAuthApplicationSchema,
  deleteOAuthApplicationSchema,
  getApplicationInfoSchema,
  getOAuthApplicationSchema,
  regenerateClientSecretSchema,
  updateApprovalStatusSchema,
  updateOAuthApplicationSchema,
} from "../../schemas/oauth-applications";
import { revokeUserApplicationAccessSchema } from "../../schemas/oauth-flow";
import { createTRPCRouter, protectedProcedure } from "../init";

const logger = createLoggerWithContext("trpc:oauth-applications");

export const oauthApplicationsRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const { db, teamId } = ctx;
    const applications = await getOAuthApplicationsByTeamFromD1(teamId!, db);

    return {
      data: applications,
    };
  }),

  getApplicationInfo: protectedProcedure
    .input(getApplicationInfoSchema)
    .query(async ({ ctx, input }) => getOAuthApplicationInfo(input, ctx.db)),

  authorize: protectedProcedure
    .input(authorizeOAuthApplicationSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, session } = ctx;
      const { clientId, decision, scopes, redirectUri, state, codeChallenge, teamId } = input;

      // Validate client_id first (needed for both allow and deny)
      const application = await getOAuthApplicationByClientIdFromD1(clientId, db);
      if (!application || !application.active) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid client_id",
        });
      }

      // Validate scopes against application's registered scopes (prevent privilege escalation)
      const invalidScopes = scopes.filter((scope) => !application.scopes.includes(scope));

      if (invalidScopes.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Invalid scopes: ${invalidScopes.join(", ")}`,
        });
      }

      const redirectUrl = new URL(redirectUri);

      // Handle denial early - no need to check team membership for denial
      if (decision === "deny") {
        redirectUrl.searchParams.set("error", "access_denied");
        redirectUrl.searchParams.set("error_description", "User denied access");
        if (state) {
          redirectUrl.searchParams.set("state", state);
        }
        return { redirect_url: redirectUrl.toString() };
      }

      // Only validate team membership for "allow" decisions
      const hasTeamAccess = session.teamMembershipIds?.includes(teamId);

      if (!hasTeamAccess) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "User is not a member of the specified team",
        });
      }

      // Enforce PKCE for public clients
      if (application.isPublic && !codeChallenge) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "PKCE is required for public clients",
        });
      }

      // Create authorization code
      const authCode = await createAuthorizationCodeInD1({
        db,
        publicApplicationId: application.id,
        userId: session.user.id,
        publicTeamId: teamId,
        scopes,
        redirectUri,
        codeChallenge,
      });

      if (!authCode) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create authorization code",
        });
      }

      // Send app installation email only if this is the first time authorizing this app
      try {
        // Check if user has ever authorized this application for this team (including expired tokens)
        const hasAuthorizedBefore = await hasUserEverAuthorizedAppInD1({
          db,
          userId: session.user.id,
          publicTeamId: teamId,
          publicApplicationId: application.id,
        });

        if (!hasAuthorizedBefore) {
          // Get team information
          const teamName = await getOAuthTeamNameFromD1(teamId, db);

          if (teamName && session.user.email) {
            const [{ AppInstalledEmail }, { render }] = await Promise.all([
              import("@tamias/email/emails/app-installed"),
              import("@tamias/email/render"),
            ]);

            const html = await render(
              AppInstalledEmail({
                email: session.user.email,
                teamName,
                appName: application.name,
              }),
            );

            await sendEmail({
              from: getSupportFromDisplay(),
              to: session.user.email,
              subject: "An app has been added to your team",
              html,
            });
          }
        }
      } catch (error) {
        // Log error but don't fail the OAuth flow
        logger.error("Failed to send app installation email", {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      // Build success redirect URL
      redirectUrl.searchParams.set("code", authCode.code);
      if (state) {
        redirectUrl.searchParams.set("state", state);
      }

      return { redirect_url: redirectUrl.toString() };
    }),

  create: protectedProcedure
    .input(createOAuthApplicationSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, teamId, session } = ctx;

      const application = await createOAuthApplicationInD1({
        db,
        ...input,
        publicTeamId: teamId!,
        createdByUserId: session.user.id,
      });

      return application;
    }),

  get: protectedProcedure.input(getOAuthApplicationSchema).query(async ({ ctx, input }) => {
    const { db, teamId } = ctx;

    const application = await getOAuthApplicationByIdFromD1(
      {
        publicApplicationId: input.id,
        publicTeamId: teamId!,
      },
      db,
    );

    if (!application) {
      throw new TRPCError({ code: "NOT_FOUND", message: "OAuth application not found" });
    }

    return application;
  }),

  update: protectedProcedure
    .input(updateOAuthApplicationSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, teamId } = ctx;
      const { id, ...updateData } = input;

      const application = await updateOAuthApplicationInD1({
        db,
        ...updateData,
        publicApplicationId: id,
        publicTeamId: teamId!,
      });

      if (!application) {
        throw new TRPCError({ code: "NOT_FOUND", message: "OAuth application not found" });
      }

      return application;
    }),

  delete: protectedProcedure
    .input(deleteOAuthApplicationSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, teamId } = ctx;

      const result = await deleteOAuthApplicationInD1({
        db,
        publicApplicationId: input.id,
        publicTeamId: teamId!,
      });

      if (!result) {
        throw new TRPCError({ code: "NOT_FOUND", message: "OAuth application not found" });
      }

      return { success: true };
    }),

  regenerateSecret: protectedProcedure
    .input(regenerateClientSecretSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, teamId } = ctx;

      const result = await regenerateOAuthClientSecretInD1({
        db,
        publicApplicationId: input.id,
        publicTeamId: teamId!,
      });

      if (!result) {
        throw new TRPCError({ code: "NOT_FOUND", message: "OAuth application not found" });
      }

      return result;
    }),

  authorized: protectedProcedure.query(async ({ ctx }) => {
    const { db, teamId, session } = ctx;

    const applications = await getUserAuthorizedApplicationsFromD1({
      db,
      userId: session.user.id,
      publicTeamId: teamId!,
    });

    return {
      data: applications,
    };
  }),

  revokeAccess: protectedProcedure
    .input(revokeUserApplicationAccessSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, session } = ctx;

      await revokeUserApplicationTokensInD1({
        db,
        userId: session.user.id,
        publicApplicationId: input.applicationId,
      });

      return { success: true };
    }),

  updateApprovalStatus: protectedProcedure
    .input(updateApprovalStatusSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, teamId, session } = ctx;

      // Get full application details before updating
      const application = await getOAuthApplicationByIdFromD1(
        {
          publicApplicationId: input.id,
          publicTeamId: teamId!,
        },
        db,
      );

      if (!application) {
        throw new TRPCError({ code: "NOT_FOUND", message: "OAuth application not found" });
      }

      const result = await updateOAuthApplicationStatusInD1({
        db,
        publicApplicationId: input.id,
        publicTeamId: teamId!,
        status: input.status,
      });

      if (!result) {
        throw new TRPCError({ code: "NOT_FOUND", message: "OAuth application not found" });
      }

      // Send email notification when status changes to "pending"
      if (input.status === "pending") {
        try {
          // Get team information
          const teamName = await getOAuthTeamNameFromD1(teamId!, db);

          if (teamName && session.user.email) {
            const [{ AppReviewRequestEmail }, { render }] = await Promise.all([
              import("@tamias/email/emails/app-review-request"),
              import("@tamias/email/render"),
            ]);

            const html = await render(
              AppReviewRequestEmail({
                applicationName: application.name,
                developerName: application.developerName || undefined,
                teamName,
                userEmail: session.user.email,
              }),
            );

            await sendEmail({
              from: getSupportFromDisplay(),
              to: "pontus@tamias.xyz",
              subject: `Application Review Request - ${application.name}`,
              html,
            });
          }
        } catch (error) {
          // Log error but don't fail the mutation
          logger.error("Failed to send application review request", {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      return result;
    }),
});
