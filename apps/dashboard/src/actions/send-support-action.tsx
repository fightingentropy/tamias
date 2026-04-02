import { z } from "zod";
import { postAction } from "./post-action";

export const sendSupportActionSchema = z.object({
  subject: z.string(),
  priority: z.string(),
  type: z.string(),
  message: z.string(),
  url: z.string().optional(),
});

export function sendSupportAction(
  input: z.infer<typeof sendSupportActionSchema>,
) {
  return postAction("/api/actions/send-support", input);
}
