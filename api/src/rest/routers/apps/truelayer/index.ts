import { OpenAPIHono } from "@hono/zod-openapi";
import type { Context } from "../../../types";
import { oauthCallbackRouter } from "./oauth-callback";

const app = new OpenAPIHono<Context>();

app.route("/oauth-callback", oauthCallbackRouter);

export { app as truelayerRouter };
