import { z } from "zod";
import { postAction } from "../post-action";

export const getTaxRateActionSchema = z.object({
  name: z.string().min(2),
});

export function getTaxRateAction(
  input: z.infer<typeof getTaxRateActionSchema>,
): Promise<{ taxRate: number; country?: string }> {
  return postAction("/api/actions/ai/tax-rate", input);
}
