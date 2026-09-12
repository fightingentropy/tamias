import { runIdempotentMutation } from "../services/mutation-safety";

type InvoiceMutationArgs<Result> = Omit<
  Parameters<typeof runIdempotentMutation<Result>>[0],
  "scope" | "resourceType"
> & { action: string };

export function runIdempotentInvoiceMutation<Result>(args: InvoiceMutationArgs<Result>) {
  const { action, ...input } = args;
  return runIdempotentMutation({ ...input, scope: `invoice.${action}`, resourceType: "invoice" });
}
