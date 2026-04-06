import { createTRPCRouter } from "../init";
import { invoiceAnalyticsProcedures } from "./invoice-analytics";
import { invoiceDefaultProcedures } from "./invoice-defaults";
import { invoiceDeliveryProcedures } from "./invoice-delivery";
import { invoiceMutationProcedures } from "./invoice-mutations";
import { invoiceReadProcedures } from "./invoice-reads";

export const invoiceRouter = createTRPCRouter({
  ...invoiceReadProcedures,
  ...invoiceDefaultProcedures,
  ...invoiceMutationProcedures,
  ...invoiceDeliveryProcedures,
  ...invoiceAnalyticsProcedures,
});
