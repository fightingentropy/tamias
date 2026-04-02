import { postAction } from "@/actions/post-action";
import { sendSupportSchema } from "./schema";

export function sendSupportAction(
  input: import("zod").infer<typeof sendSupportSchema>,
) {
  return postAction("/support/submit", input);
}
