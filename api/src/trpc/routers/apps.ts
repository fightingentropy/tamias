import {
  disconnectApp,
  getApps,
  removeWhatsAppConnection,
  updateAppSettings,
  updateAppSettingsBulk,
} from "@tamias/app-data/queries";
import { z } from "zod";
import {
  disconnectAppSchema,
  removeWhatsAppConnectionSchema,
  updateAppSettingsSchema,
} from "../../schemas/apps";
import { createTRPCRouter, protectedProcedure } from "../init";

export function withoutAppCredentials<
  T extends { config?: unknown; app_id?: string; appId?: string },
>(app: T) {
  const { config, ...publicApp } = app;
  // WhatsApp displays connected numbers. Allowlist these fields; never copy
  // arbitrary provider config (access/refresh tokens, client secrets, etc.).
  const connections =
    (app.app_id ?? app.appId) === "whatsapp" &&
    config &&
    typeof config === "object" &&
    "connections" in config &&
    Array.isArray(config.connections)
      ? config.connections
          .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
          .map((item) => ({
            phoneNumber: typeof item.phoneNumber === "string" ? item.phoneNumber : "",
            displayName: typeof item.displayName === "string" ? item.displayName : undefined,
            connectedAt: typeof item.connectedAt === "string" ? item.connectedAt : "",
          }))
      : [];
  return { ...publicApp, connections };
}

export const appsRouter = createTRPCRouter({
  get: protectedProcedure.query(async ({ ctx: { db, teamId } }) => {
    return (await getApps(db, teamId!)).map(withoutAppCredentials);
  }),

  disconnect: protectedProcedure
    .input(disconnectAppSchema)
    .mutation(async ({ ctx: { db, teamId }, input }) => {
      const { appId } = input;

      const app = await disconnectApp(db, { appId, teamId: teamId! });
      return app ? withoutAppCredentials(app) : null;
    }),

  update: protectedProcedure
    .input(updateAppSettingsSchema)
    .mutation(async ({ ctx: { db, teamId }, input }) => {
      const { appId, option } = input;

      return withoutAppCredentials(
        await updateAppSettings(db, {
          appId,
          teamId: teamId!,
          option,
        }),
      );
    }),

  updateSettings: protectedProcedure
    .input(
      z.object({
        appId: z.string(),
        settings: z.array(
          z.object({
            id: z.string(),
            label: z.string().optional(),
            description: z.string().optional(),
            type: z.string().optional(),
            required: z.boolean().optional(),
            value: z.unknown(),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx: { db, teamId }, input }) => {
      const { appId, settings } = input;

      return withoutAppCredentials(
        await updateAppSettingsBulk(db, {
          appId,
          teamId: teamId!,
          settings,
        }),
      );
    }),

  removeWhatsAppConnection: protectedProcedure
    .input(removeWhatsAppConnectionSchema)
    .mutation(async ({ ctx: { db, teamId }, input }) => {
      const { phoneNumber } = input;

      const app = await removeWhatsAppConnection(db, {
        teamId: teamId!,
        phoneNumber,
      });
      return app ? withoutAppCredentials(app) : null;
    }),
});
