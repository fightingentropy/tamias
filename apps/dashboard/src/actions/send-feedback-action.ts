import { z } from "zod";
import { postAction } from "./post-action";

export const sendFeedbackActionSchema = z.object({
  feedback: z.string(),
});

export function sendFeebackAction(
  input: z.infer<typeof sendFeedbackActionSchema>,
) {
  return postAction("/api/actions/send-feedback", input);
}
