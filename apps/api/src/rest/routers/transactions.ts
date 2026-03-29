import type { Context } from "../types";
import { OpenAPIHono } from "@hono/zod-openapi";
import { registerTransactionReadRoutes } from "./transactions-read-routes";
import { registerTransactionWriteRoutes } from "./transactions-write-routes";

const app = new OpenAPIHono<Context>();

registerTransactionReadRoutes(app);
registerTransactionWriteRoutes(app);

export const transactionsRouter = app;
