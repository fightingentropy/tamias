import { z } from "@hono/zod-openapi";

export const registerUploadSchema = z.object({
  pathTokens: z.array(z.string()),
  storageId: z.string(),
  teamId: z.string().optional(),
  bucket: z.string().optional(),
  contentType: z.string().optional(),
  size: z.number().nonnegative().optional(),
});
