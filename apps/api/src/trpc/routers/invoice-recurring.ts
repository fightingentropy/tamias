import { createTRPCRouter } from "../init";
import { invoiceRecurringMutationProcedures } from "./invoice-recurring-mutations";
import { invoiceRecurringReadProcedures } from "./invoice-recurring-reads";

export const invoiceRecurringRouter = createTRPCRouter({
  ...invoiceRecurringReadProcedures,
  ...invoiceRecurringMutationProcedures,
});
