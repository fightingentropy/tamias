import { z } from "zod";

export const oauthCallbackSearchParamsSchema = z.object({
  status: z.enum(["success", "error"]),
  error: z.string().optional(),
});

export type OAuthStatus = z.infer<typeof oauthCallbackSearchParamsSchema>["status"];
