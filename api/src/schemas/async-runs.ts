import { z } from "@hono/zod-openapi";

export const getCurrentUserRunSchema = z.object({
  runId: z.string(),
});
