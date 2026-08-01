import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  beginIdempotentOperation,
  completeIdempotentOperation,
  failIdempotentOperation,
  getInvoiceById,
  getInvoiceByPaymentIntentId,
  getTeamByStripeAccountId,
  requireIdempotentOperationReconciliation,
  updateInvoice,
  updateTeamById,
} from "@tamias/app-data/queries";
import { enqueue } from "@tamias/job-client";
import { logger } from "@tamias/logger";
import { HTTPException } from "hono/http-exception";
import Stripe from "stripe";
import type { Context } from "../../../types";

const app = new OpenAPIHono<Context>();

const webhookResponseSchema = z.object({
  received: z.boolean(),
});

app.openapi(
  createRoute({
    method: "post",
    path: "/",
    summary: "Stripe webhook handler",
    operationId: "stripeWebhook",
    description:
      "Handles Stripe webhook events for invoice payments. Verifies webhook signature and processes payment events.",
    tags: ["Webhooks"],
    responses: {
      200: {
        description: "Webhook processed successfully",
        content: {
          "application/json": {
            schema: webhookResponseSchema,
          },
        },
      },
      400: {
        description: "Invalid webhook signature or payload",
      },
    },
  }),
  async (c) => {
    const db = c.get("db");
    const signature = c.req.header("stripe-signature");

    if (!signature) {
      throw new HTTPException(400, {
        message: "Missing stripe-signature header",
      });
    }

    const webhookSecret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
    if (!webhookSecret) {
      logger.error("STRIPE_CONNECT_WEBHOOK_SECRET not configured");
      throw new HTTPException(500, {
        message: "Webhook secret not configured",
      });
    }

    let event: Stripe.Event;

    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
      const rawBody = await c.req.text();

      event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret);
    } catch (err) {
      logger.error("Stripe webhook signature verification failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      throw new HTTPException(400, { message: "Invalid webhook signature" });
    }

    logger.info("Stripe webhook received", {
      type: event.type,
      id: event.id,
    });
    const eventObjectId =
      "id" in event.data.object && typeof event.data.object.id === "string"
        ? event.data.object.id
        : `${event.data.object.object}:${event.id}`;

    let operationTeamId = "stripe-global";
    if (event.data.object.object === "payment_intent") {
      operationTeamId =
        (event.data.object as Stripe.PaymentIntent).metadata?.team_id ?? operationTeamId;
    } else if (event.data.object.object === "charge") {
      const paymentIntentId = (event.data.object as Stripe.Charge).payment_intent;
      if (typeof paymentIntentId === "string") {
        operationTeamId =
          (await getInvoiceByPaymentIntentId(db, paymentIntentId))?.teamId ?? operationTeamId;
      }
    } else if (event.data.object.object === "account") {
      operationTeamId =
        (await getTeamByStripeAccountId(db, (event.data.object as Stripe.Account).id))?.id ??
        operationTeamId;
    }

    const operation = await beginIdempotentOperation(db, {
      teamId: operationTeamId,
      scope: "webhook.stripe",
      idempotencyKey: event.id,
      request: {
        eventId: event.id,
        eventType: event.type,
        objectId: eventObjectId,
      },
    });
    if (operation.state === "replayed") {
      return c.json({ received: true });
    }

    let domainMutationCompleted = false;
    try {
      switch (event.type) {
        case "payment_intent.succeeded": {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          const invoiceId = paymentIntent.metadata?.invoice_id;
          const teamId = paymentIntent.metadata?.team_id;

          if (!invoiceId || !teamId) {
            logger.warn("Payment intent missing invoice metadata", {
              paymentIntentId: paymentIntent.id,
            });
            break;
          }

          const paidAt = new Date().toISOString();

          // Update invoice to paid status
          const updatedInvoice = await updateInvoice(db, {
            id: invoiceId,
            teamId,
            status: "paid",
            paidAt,
            paymentIntentId: paymentIntent.id,
          });

          if (updatedInvoice) {
            domainMutationCompleted = true;
            logger.info("Invoice marked as paid", {
              invoiceId,
              paymentIntentId: paymentIntent.id,
              amount: paymentIntent.amount,
            });

            // Fetch full invoice details for notification
            const invoice = await getInvoiceById(db, { id: invoiceId });

            if (invoice) {
              // Trigger notification job
              await enqueue(
                "notification",
                {
                  type: "invoice_paid",
                  invoiceId,
                  invoiceNumber: invoice.invoiceNumber || "",
                  teamId,
                  customerName: invoice.customerName || "",
                  paidAt,
                },
                "notifications",
              );

              logger.info("Invoice paid notification triggered", {
                invoiceId,
                invoiceNumber: invoice.invoiceNumber,
              });
            }
          } else {
            logger.warn("Failed to update invoice - not found or unauthorized", {
              invoiceId,
              teamId,
            });
          }

          break;
        }

        case "payment_intent.payment_failed": {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          const invoiceId = paymentIntent.metadata?.invoice_id;

          logger.info("Payment failed for invoice", {
            invoiceId,
            paymentIntentId: paymentIntent.id,
            error: paymentIntent.last_payment_error?.message,
          });

          break;
        }

        case "charge.refunded": {
          const charge = event.data.object as Stripe.Charge;
          const paymentIntentId = charge.payment_intent as string;

          if (!paymentIntentId) {
            logger.warn("Refunded charge missing payment_intent", {
              chargeId: charge.id,
            });
            break;
          }

          // Find the invoice by payment intent ID
          const invoice = await getInvoiceByPaymentIntentId(db, paymentIntentId);

          if (!invoice) {
            logger.warn("No invoice found for refunded payment intent", {
              paymentIntentId,
              chargeId: charge.id,
            });
            break;
          }

          const refundedAt = new Date().toISOString();

          // Update invoice: set status to refunded, keep payment history, set refundedAt
          const updatedInvoice = await updateInvoice(db, {
            id: invoice.id,
            teamId: invoice.teamId,
            status: "refunded",
            refundedAt,
          });

          if (updatedInvoice) {
            domainMutationCompleted = true;
            logger.info("Invoice marked as refunded", {
              invoiceId: invoice.id,
              invoiceNumber: invoice.invoiceNumber,
              paymentIntentId,
            });

            // Trigger refund notification job
            await enqueue(
              "notification",
              {
                type: "invoice_refunded",
                invoiceId: invoice.id,
                invoiceNumber: invoice.invoiceNumber || "",
                teamId: invoice.teamId,
                customerName: invoice.customerName || "",
                refundedAt,
              },
              "notifications",
            );

            logger.info("Invoice refund notification triggered", {
              invoiceId: invoice.id,
              invoiceNumber: invoice.invoiceNumber,
            });
          }

          break;
        }

        case "account.updated": {
          // Handle connected account status changes
          const account = event.data.object as Stripe.Account;

          logger.info("Connected account updated", {
            accountId: account.id,
            chargesEnabled: account.charges_enabled,
            payoutsEnabled: account.payouts_enabled,
          });

          // Find the team associated with this Stripe account
          const team = await getTeamByStripeAccountId(db, account.id);

          if (team) {
            // Determine new status based on account capabilities
            let newStatus: string;
            if (account.charges_enabled && account.payouts_enabled) {
              newStatus = "connected";
            } else if (account.charges_enabled) {
              // Can accept charges but payouts restricted
              newStatus = "restricted";
            } else {
              // Cannot accept charges - payments will fail
              newStatus = "disabled";
            }

            // Only update if status changed
            if (team.stripeConnectStatus !== newStatus) {
              await updateTeamById(db, {
                id: team.id,
                data: {
                  stripeConnectStatus: newStatus,
                },
              });
              domainMutationCompleted = true;

              logger.info("Team Stripe status updated", {
                teamId: team.id,
                previousStatus: team.stripeConnectStatus,
                newStatus,
                accountId: account.id,
              });
            }
          } else {
            logger.warn("No team found for Stripe account", {
              accountId: account.id,
            });
          }

          break;
        }

        default:
          logger.debug("Unhandled Stripe webhook event type", {
            type: event.type,
          });
      }

      await completeIdempotentOperation(db, {
        teamId: operationTeamId,
        scope: "webhook.stripe",
        idempotencyKey: event.id,
        leaseToken: operation.leaseToken,
        result: { eventId: event.id, eventType: event.type },
        audit: {
          actorType: "webhook",
          actorId: event.id,
          action: `webhook.stripe.${event.type}`,
          resourceType: event.data.object.object,
          resourceId: eventObjectId,
          confirmationId: event.id,
          environment: process.env.TAMIAS_PAYMENT_ENVIRONMENT ?? "sandbox",
          payload: { eventType: event.type },
        },
        outbox: {
          topic: "webhook.stripe.processed",
          aggregateType: event.data.object.object,
          aggregateId: eventObjectId,
          payload: { eventId: event.id, eventType: event.type },
        },
      });
    } catch (err) {
      if (domainMutationCompleted) {
        await requireIdempotentOperationReconciliation(db, {
          teamId: operationTeamId,
          scope: "webhook.stripe",
          idempotencyKey: event.id,
          leaseToken: operation.leaseToken,
          error: err,
          providerResult: { eventId: event.id, eventType: event.type },
        });
      } else {
        await failIdempotentOperation(db, {
          teamId: operationTeamId,
          scope: "webhook.stripe",
          idempotencyKey: event.id,
          leaseToken: operation.leaseToken,
          error: err,
        });
      }
      logger.error("Error processing Stripe webhook", {
        error: err instanceof Error ? err.message : String(err),
        eventType: event.type,
        eventId: event.id,
      });
      throw new HTTPException(500, { message: "Webhook processing failed" });
    }

    return c.json({ received: true });
  },
);

export { app as stripeWebhookRouter };
