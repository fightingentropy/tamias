import { OpenAPIHono } from "@hono/zod-openapi";
import type { Context } from "../../types";
import { downloadRouter } from "./download";
import { serveRouter } from "./serve";

const app = new OpenAPIHono<Context>();

app.route("/", serveRouter);

app.route("/download", downloadRouter);

export { app as filesRouter };
