import { z } from "zod";
import { postAction } from "@/actions/post-action";

export const manualSyncTransactionsActionSchema = z.object({
  connectionId: z.string(),
});

export function manualSyncTransactionsAction(
  input: z.infer<typeof manualSyncTransactionsActionSchema>,
): Promise<{ runId?: string }> {
  return postAction("/api/actions/transactions/manual-sync", input);
}
