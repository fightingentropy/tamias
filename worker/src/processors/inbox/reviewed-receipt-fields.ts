import { z } from "zod";

const reviewedReceiptSchema = z.object({
  source: z.literal("native"),
  capturedFields: z.object({
    displayName: z.string().min(1),
    amount: z.number().finite().nullable().optional(),
    currency: z.string().regex(/^[A-Z]{3}$/),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .optional(),
  }),
});

/** Human-reviewed values remain authoritative when asynchronous extraction finishes. */
export function reviewedReceiptFields(meta: unknown) {
  const reviewed = reviewedReceiptSchema.safeParse(meta);
  return reviewed.success ? reviewed.data.capturedFields : {};
}
