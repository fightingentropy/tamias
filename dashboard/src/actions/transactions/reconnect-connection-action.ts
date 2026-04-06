import { z } from "zod";
import { postAction } from "@/actions/post-action";

export const reconnectConnectionActionSchema = z.object({
  connectionId: z.string(),
  provider: z.enum(["gocardless", "plaid", "teller"]),
});

export function reconnectConnectionAction(
  input: z.infer<typeof reconnectConnectionActionSchema>,
) : Promise<{ runId?: string }> {
  return postAction("/api/actions/transactions/reconnect", input);
}
