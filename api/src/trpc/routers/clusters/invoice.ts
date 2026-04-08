import { invoiceRouter } from "../invoice";
import { invoicePaymentsRouter } from "../invoice-payments";
import { invoiceProductsRouter } from "../invoice-products";
import { invoiceRecurringRouter } from "../invoice-recurring";
import { invoiceTemplateRouter } from "../invoice-template";

export const invoiceRouters = {
  invoice: invoiceRouter,
  invoicePayments: invoicePaymentsRouter,
  invoiceProducts: invoiceProductsRouter,
  invoiceRecurring: invoiceRecurringRouter,
  invoiceTemplate: invoiceTemplateRouter,
};
