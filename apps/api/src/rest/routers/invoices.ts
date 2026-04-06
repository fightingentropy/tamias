import { OpenAPIHono } from "@hono/zod-openapi";
import type { Context } from "../types";
import { registerInvoiceReadRoutes } from "./invoices-read-routes";
import { registerInvoiceWriteRoutes } from "./invoices-write-routes";

const app = new OpenAPIHono<Context>();

registerInvoiceReadRoutes(app);
registerInvoiceWriteRoutes(app);

export const invoicesRouter = app;
