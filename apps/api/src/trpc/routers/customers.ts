import {
  clearCustomerEnrichment,
  deleteCustomer,
  getCustomerById,
  getCustomerInvoiceSummary,
  getCustomers,
  toggleCustomerPortal,
  updateCustomerEnrichmentStatus,
  upsertCustomer,
} from "@tamias/app-data/queries";
import {
  getCustomerPortalData,
  getCustomerPortalInvoicesPage,
} from "@tamias/app-services/public-reads";
import { enqueue } from "@tamias/job-client";
import { createLoggerWithContext } from "@tamias/logger";
import { TRPCError } from "@trpc/server";
import {
  deleteCustomerSchema,
  enrichCustomerSchema,
  getCustomerByIdSchema,
  getCustomerByPortalIdSchema,
  getCustomerInvoiceSummarySchema,
  getCustomersSchema,
  getPortalInvoicesSchema,
  toggleCustomerPortalSchema,
  upsertCustomerSchema,
} from "../../schemas/customers";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../init";

const logger = createLoggerWithContext("trpc:customers");

export const customersRouter = createTRPCRouter({
  get: protectedProcedure
    .input(getCustomersSchema.optional())
    .query(async ({ ctx: { teamId, db }, input }) => {
      return getCustomers(db, {
        teamId: teamId!,
        ...input,
      });
    }),

  getById: protectedProcedure
    .input(getCustomerByIdSchema)
    .query(async ({ ctx: { db, teamId }, input }) => {
      return getCustomerById(db, {
        id: input.id,
        teamId: teamId!,
      });
    }),

  delete: protectedProcedure
    .input(deleteCustomerSchema)
    .mutation(async ({ ctx: { db, teamId }, input }) => {
      return deleteCustomer(db, {
        id: input.id,
        teamId: teamId!,
      });
    }),

  upsert: protectedProcedure
    .input(upsertCustomerSchema)
    .mutation(async ({ ctx: { db, teamId, session }, input }) => {
      const isNewCustomer = !input.id;

      const customer = await upsertCustomer(db, {
        ...input,
        teamId: teamId!,
        userId: session.user.convexId ?? undefined,
      });

      // Auto-trigger enrichment for new customers with a website
      if (isNewCustomer && customer?.website && customer?.id) {
        try {
          // Set status to pending first, then trigger job
          await updateCustomerEnrichmentStatus(db, {
            customerId: customer.id,
            status: "pending",
          });

          await enqueue(
            "enrich-customer",
            {
              customerId: customer.id,
              teamId: teamId!,
            },
            "customers",
            {
              publicTeamId: teamId!,
              appUserId: session.user.convexId ?? undefined,
            },
          );
        } catch (error) {
          // Log but don't fail the customer creation
          logger.error("Failed to trigger customer enrichment", {
            error: error instanceof Error ? error.message : String(error),
          });
          // Reset status since job wasn't queued
          await updateCustomerEnrichmentStatus(db, {
            customerId: customer.id,
            status: null,
          }).catch(() => {}); // Ignore errors on cleanup
        }
      }

      return customer;
    }),

  getInvoiceSummary: protectedProcedure
    .input(getCustomerInvoiceSummarySchema)
    .query(async ({ ctx: { db, teamId }, input }) => {
      return getCustomerInvoiceSummary(db, {
        customerId: input.id,
        teamId: teamId!,
      });
    }),

  enrich: protectedProcedure
    .input(enrichCustomerSchema)
    .mutation(async ({ ctx: { db, teamId }, input }) => {
      const customer = await getCustomerById(db, {
        id: input.id,
        teamId: teamId!,
      });

      if (!customer) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Customer not found",
        });
      }

      if (!customer.website) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Customer has no website - enrichment requires a website",
        });
      }

      // Set status to pending first, then trigger job
      await updateCustomerEnrichmentStatus(db, {
        customerId: customer.id,
        status: "pending",
      });

      await enqueue(
        "enrich-customer",
        {
          customerId: customer.id,
          teamId: teamId!,
        },
        "customers",
        {
          publicTeamId: teamId!,
        },
      );

      return { queued: true };
    }),

  cancelEnrichment: protectedProcedure
    .input(enrichCustomerSchema)
    .mutation(async ({ ctx: { db, teamId }, input }) => {
      const customer = await getCustomerById(db, {
        id: input.id,
        teamId: teamId!,
      });

      if (!customer) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Customer not found",
        });
      }

      // Reset status to null (no enrichment in progress)
      // The job may still complete in background but UI won't show as processing
      await updateCustomerEnrichmentStatus(db, {
        customerId: customer.id,
        status: null,
      });

      return { cancelled: true };
    }),

  clearEnrichment: protectedProcedure
    .input(enrichCustomerSchema)
    .mutation(async ({ ctx: { db, teamId }, input }) => {
      const customer = await getCustomerById(db, {
        id: input.id,
        teamId: teamId!,
      });

      if (!customer) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Customer not found",
        });
      }

      await clearCustomerEnrichment(db, {
        customerId: customer.id,
        teamId: teamId!,
      });

      return { cleared: true };
    }),

  togglePortal: protectedProcedure
    .input(toggleCustomerPortalSchema)
    .mutation(async ({ ctx: { db, teamId }, input }) => {
      return toggleCustomerPortal(db, {
        customerId: input.customerId,
        teamId: teamId!,
        enabled: input.enabled,
      });
    }),

  getByPortalId: publicProcedure
    .input(getCustomerByPortalIdSchema)
    .query(async ({ ctx: { db }, input }) =>
      getCustomerPortalData({ db, portalId: input.portalId }),
    ),

  getPortalInvoices: publicProcedure
    .input(getPortalInvoicesSchema)
    .query(async ({ ctx: { db }, input }) =>
      getCustomerPortalInvoicesPage({
        db,
        portalId: input.portalId,
        cursor: input.cursor,
        pageSize: input.pageSize,
      }),
    ),
});
