import { registerUploadSchema } from "../../schemas/uploads";
import {
  api,
  type StorageId,
  withUserConvexClient,
} from "../../services/convex-user";
import { createTRPCRouter, protectedProcedure } from "../init";

export const uploadsRouter = createTRPCRouter({
  generateUrl: protectedProcedure.mutation(async ({ ctx: { accessToken } }) => {
    return withUserConvexClient(accessToken, (client) =>
      client.mutation(api.files.generateUploadUrl, {}),
    );
  }),

  register: protectedProcedure
    .input(registerUploadSchema)
    .mutation(async ({ ctx: { accessToken }, input }) => {
      return withUserConvexClient(accessToken, (client) =>
        client.mutation(api.files.registerUpload, {
          ...input,
          storageId: input.storageId as StorageId,
        }),
      );
    }),
});
