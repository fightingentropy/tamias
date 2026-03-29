import { deleteApiKeySchema, upsertApiKeySchema } from "../../schemas/api-keys";
import { resend } from "../../services/resend";
import { createTRPCRouter, protectedProcedure } from "../init";
import {
  createApiKeyInConvex,
  deleteApiKeyInConvex,
  getApiKeysByTeamFromConvex,
  updateApiKeyInConvex,
} from "@tamias/app-services/foundation";
import { ApiKeyCreatedEmail } from "@tamias/email/emails/api-key-created";
import { logger } from "@tamias/logger";
import { getSupportFromDisplay } from "@tamias/utils/envs";

export const apiKeysRouter = createTRPCRouter({
  get: protectedProcedure.query(async ({ ctx: { teamId } }) => {
    return getApiKeysByTeamFromConvex(teamId!);
  }),

  upsert: protectedProcedure
    .input(upsertApiKeySchema)
    .mutation(async ({ ctx: { teamId, session, geo }, input }) => {
      if (!input.id && !session.user.convexId) {
        throw new Error("Missing Convex user id");
      }

      const { data, key } = input.id
        ? await updateApiKeyInConvex({
            publicApiKeyId: input.id,
            publicTeamId: teamId!,
            name: input.name,
            scopes: input.scopes,
          })
        : await createApiKeyInConvex({
            publicTeamId: teamId!,
            userId: session.user.convexId!,
            name: input.name,
            scopes: input.scopes,
          });

      if (data) {
        try {
          // We don't need to await this, it will be sent in the background
          resend.emails.send({
            from: getSupportFromDisplay(),
            to: session.user.email!,
            subject: "New API Key Created",
            react: ApiKeyCreatedEmail({
              fullName: session.user.full_name!,
              keyName: input.name,
              createdAt: data.createdAt,
              email: session.user.email!,
              ip: geo.ip!,
            }),
          });
        } catch (error) {
          logger.error("Failed to send API key created email", {
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      return {
        key,
        data,
      };
    }),

  delete: protectedProcedure
    .input(deleteApiKeySchema)
    .mutation(async ({ ctx: { teamId }, input }) => {
      return deleteApiKeyInConvex({
        publicApiKeyId: input.id,
        publicTeamId: teamId!,
      });
    }),
});
