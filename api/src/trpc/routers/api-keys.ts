import {
  createApiKeyInD1,
  deleteApiKeyInD1,
  getApiKeysByTeamFromD1,
  updateApiKeyInD1,
} from "@tamias/app-services/foundation";
import { ApiKeyCreatedEmail } from "@tamias/email/emails/api-key-created";
import { render } from "@tamias/email/render";
import { sendEmail } from "@tamias/email/send";
import { logger } from "@tamias/logger";
import { getSupportFromDisplay } from "@tamias/utils/envs";
import { deleteApiKeySchema, upsertApiKeySchema } from "../../schemas/api-keys";
import { createTRPCRouter, protectedProcedure } from "../init";

export const apiKeysRouter = createTRPCRouter({
  get: protectedProcedure.query(async ({ ctx: { db, teamId } }) => {
    return getApiKeysByTeamFromD1(teamId!, db);
  }),

  upsert: protectedProcedure
    .input(upsertApiKeySchema)
    .mutation(async ({ ctx: { db, teamId, session, geo }, input }) => {
      const userId = session.user.id ?? session.user.id;

      if (!input.id && !userId) {
        throw new Error("Missing user id");
      }

      const { data, key } = input.id
        ? await updateApiKeyInD1({
            db,
            publicApiKeyId: input.id,
            publicTeamId: teamId!,
            name: input.name,
            scopes: input.scopes,
          })
        : await createApiKeyInD1({
            db,
            publicTeamId: teamId!,
            userId: userId!,
            name: input.name,
            scopes: input.scopes,
          });

      if (data) {
        try {
          await sendEmail({
            from: getSupportFromDisplay(),
            to: session.user.email!,
            subject: "New API Key Created",
            html: await render(
              ApiKeyCreatedEmail({
                fullName: session.user.full_name!,
                keyName: input.name,
                createdAt: data.createdAt,
                email: session.user.email!,
                ip: geo.ip!,
              }),
            ),
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
    .mutation(async ({ ctx: { db, teamId }, input }) => {
      return deleteApiKeyInD1({
        db,
        publicApiKeyId: input.id,
        publicTeamId: teamId!,
      });
    }),
});
