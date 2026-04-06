import { z } from "@hono/zod-openapi";

export const sendSupportTicketSchema = z.object({
  subject: z.string(),
  priority: z.string(),
  type: z.string(),
  message: z.string(),
  url: z.string().optional(),
});

export const sendFeedbackSchema = z.object({
  feedback: z.string(),
});
