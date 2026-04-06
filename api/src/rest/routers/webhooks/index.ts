import { OpenAPIHono } from "@hono/zod-openapi";
import { publicMiddleware } from "../../middleware";
import type { Context } from "../../types";
import { inboxWebhookRouter } from "./inbox";
import { plaidWebhookRouter } from "./plaid";
import { polarWebhookRouter } from "./polar";
import { stripeWebhookRouter } from "./stripe";
import { tellerWebhookRouter } from "./teller";
import { whatsappWebhookRouter } from "./whatsapp";

const app = new OpenAPIHono<Context>();

// Apply public middleware to all webhooks (no authentication required)
app.use("*", ...publicMiddleware);

// Mount individual webhook routes
app.route("/inbox", inboxWebhookRouter);
app.route("/plaid", plaidWebhookRouter);
app.route("/polar", polarWebhookRouter);
app.route("/stripe", stripeWebhookRouter);
app.route("/teller", tellerWebhookRouter);
app.route("/whatsapp", whatsappWebhookRouter);

export { app as webhookRouter };
