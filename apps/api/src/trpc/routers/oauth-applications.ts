import {
  createAuthorizationCodeInConvex,
  createOAuthApplicationInConvex,
  deleteOAuthApplicationInConvex,
  getOAuthApplicationByClientIdFromConvex,
  getOAuthApplicationByIdFromConvex,
  getOAuthApplicationsByTeamFromConvex,
  getTeamByPublicTeamIdFromConvex,
  getUserAuthorizedApplicationsFromConvex,
  hasUserEverAuthorizedAppInConvex,
  regenerateOAuthClientSecretInConvex,
  revokeUserApplicationTokensInConvex,
  updateOAuthApplicationInConvex,
  updateOAuthApplicationStatusInConvex,
} from "@tamias/app-services/foundation";
import { getOAuthApplicationInfo } from "@tamias/app-services/oauth-application-info";
import { AppInstalledEmail } from "@tamias/email/emails/app-installed";
import { AppReviewRequestEmail } from "@tamias/email/emails/app-review-request";
import { render } from "@tamias/email/render";
import { createLoggerWithContext } from "@tamias/logger";
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
import { resend } from "../../services/resend";
import { createTRPCRouter, protectedProcedure } from "../init";

const logger = createLoggerWithContext("trpc:oauth-applications");

export const oauthApplicationsRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const { teamId } = ctx;
    const applications = await getOAuthApplicationsByTeamFromConvex(teamId!);

    return {
      data: applications,
    };
  }),

  getApplicationInfo: protectedProcedure
    .input(getApplicationInfoSchema)
    .query(async ({ input }) => getOAuthApplicationInfo(input)),

  authorize: protectedProcedure
    .input(authorizeOAuthApplicationSchema)
    .mutation(async ({ ctx, input }) => {
      const { session } = ctx;
      const {
        clientId,
        decision,
        scopes,
        redirectUri,
        state,
        codeChallenge,
        teamId,
      } = input;

      // Validate client_id first (needed for both allow and deny)
      const application =
        await getOAuthApplicationByClientIdFromConvex(clientId);
      if (!application || !application.active) {
        throw new Error("Invalid client_id");
      }

      // Validate scopes against application's registered scopes (prevent privilege escalation)
      const invalidScopes = scopes.filter(
        (scope) => !application.scopes.includes(scope),
      );

      if (invalidScopes.length > 0) {
        throw new Error(`Invalid scopes: ${invalidScopes.join(", ")}`);
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
        throw new Error("User is not a member of the specified team");
      }

      // Enforce PKCE for public clients
      if (application.isPublic && !codeChallenge) {
        throw new Error("PKCE is required for public clients");
      }

      if (!session.user.convexId) {
        throw new Error("Missing Convex user id");
      }

      // Create authorization code
      const authCode = await createAuthorizationCodeInConvex({
        publicApplicationId: application.id,
        userId: session.user.convexId,
        publicTeamId: teamId,
        scopes,
        redirectUri,
        codeChallenge,
      });

      if (!authCode) {
        throw new Error("Failed to create authorization code");
      }

      // Send app installation email only if this is the first time authorizing this app
      try {
        // Check if user has ever authorized this application for this team (including expired tokens)
        const hasAuthorizedBefore = await hasUserEverAuthorizedAppInConvex({
          userId: session.user.convexId,
          publicTeamId: teamId,
          publicApplicationId: application.id,
        });

        if (!hasAuthorizedBefore) {
          // Get team information
          const userTeam = await getTeamByPublicTeamIdFromConvex(teamId);

          if (userTeam && session.user.email) {
            const html = await render(
              AppInstalledEmail({
                email: session.user.email,
                teamName: userTeam.name!,
                appName: application.name,
              }),
            );

            await resend.emails.send({
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
      const { teamId, session } = ctx;

      if (!session.user.convexId) {
        throw new Error("Missing Convex user id");
      }

      const application = await createOAuthApplicationInConvex({
        ...input,
        publicTeamId: teamId!,
        createdByUserId: session.user.convexId,
      });

      return application;
    }),

  get: protectedProcedure
    .input(getOAuthApplicationSchema)
    .query(async ({ ctx, input }) => {
      const { teamId } = ctx;

      const application = await getOAuthApplicationByIdFromConvex({
        publicApplicationId: input.id,
        publicTeamId: teamId!,
      });

      if (!application) {
        throw new Error("OAuth application not found");
      }

      return application;
    }),

  update: protectedProcedure
    .input(updateOAuthApplicationSchema)
    .mutation(async ({ ctx, input }) => {
      const { teamId } = ctx;
      const { id, ...updateData } = input;

      const application = await updateOAuthApplicationInConvex({
        ...updateData,
        publicApplicationId: id,
        publicTeamId: teamId!,
      });

      if (!application) {
        throw new Error("OAuth application not found");
      }

      return application;
    }),

  delete: protectedProcedure
    .input(deleteOAuthApplicationSchema)
    .mutation(async ({ ctx, input }) => {
      const { teamId } = ctx;

      const result = await deleteOAuthApplicationInConvex({
        publicApplicationId: input.id,
        publicTeamId: teamId!,
      });

      if (!result) {
        throw new Error("OAuth application not found");
      }

      return { success: true };
    }),

  regenerateSecret: protectedProcedure
    .input(regenerateClientSecretSchema)
    .mutation(async ({ ctx, input }) => {
      const { teamId } = ctx;

      const result = await regenerateOAuthClientSecretInConvex({
        publicApplicationId: input.id,
        publicTeamId: teamId!,
      });

      if (!result) {
        throw new Error("OAuth application not found");
      }

      return result;
    }),

  authorized: protectedProcedure.query(async ({ ctx }) => {
    const { teamId, session } = ctx;

    if (!session.user.convexId) {
      return { data: [] };
    }

    const applications = await getUserAuthorizedApplicationsFromConvex({
      userId: session.user.convexId,
      publicTeamId: teamId!,
    });

    return {
      data: applications,
    };
  }),

  revokeAccess: protectedProcedure
    .input(revokeUserApplicationAccessSchema)
    .mutation(async ({ ctx, input }) => {
      const { session } = ctx;

      if (!session.user.convexId) {
        throw new Error("Missing Convex user id");
      }

      await revokeUserApplicationTokensInConvex({
        userId: session.user.convexId,
        publicApplicationId: input.applicationId,
      });

      return { success: true };
    }),

  updateApprovalStatus: protectedProcedure
    .input(updateApprovalStatusSchema)
    .mutation(async ({ ctx, input }) => {
      const { teamId, session } = ctx;

      // Get full application details before updating
      const application = await getOAuthApplicationByIdFromConvex({
        publicApplicationId: input.id,
        publicTeamId: teamId!,
      });

      if (!application) {
        throw new Error("OAuth application not found");
      }

      const result = await updateOAuthApplicationStatusInConvex({
        publicApplicationId: input.id,
        publicTeamId: teamId!,
        status: input.status,
      });

      if (!result) {
        throw new Error("OAuth application not found");
      }

      // Send email notification when status changes to "pending"
      if (input.status === "pending") {
        try {
          // Get team information
          const currentTeam = await getTeamByPublicTeamIdFromConvex(teamId!);

          if (currentTeam && session.user.email) {
            const html = await render(
              AppReviewRequestEmail({
                applicationName: application.name,
                developerName: application.developerName || undefined,
                teamName: currentTeam.name!,
                userEmail: session.user.email,
              }),
            );

            await resend.emails.send({
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
