import {
  getInstitutionById,
  getInstitutions,
  updateInstitutionUsage,
} from "@tamias/app-data/queries";
import { createLoggerWithContext } from "@tamias/logger";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  fetchPlaidInstitutionsForSearch,
  type InstitutionTrpcRow,
} from "../lib/plaid-institution-fallback";
import { createTRPCRouter, protectedProcedure } from "../init";

const logger = createLoggerWithContext("trpc:institutions");

const getInstitutionsSchema = z.object({
  q: z.string().optional(),
  countryCode: z.string(),
  limit: z.number().optional().default(50),
  excludeProviders: z.array(z.enum(["plaid", "teller"])).optional(),
});

const getInstitutionByIdSchema = z.object({
  id: z.string(),
});

const updateUsageSchema = z.object({ id: z.string() });

function mapInstitutionRecords(results: Awaited<ReturnType<typeof getInstitutions>>): InstitutionTrpcRow[] {
  return results.map((institution) => ({
    id: institution.id,
    name: institution.name,
    logo: institution.logo ?? null,
    popularity: institution.popularity,
    availableHistory: institution.availableHistory ?? null,
    maximumConsentValidity: institution.maximumConsentValidity ?? null,
    provider: institution.provider,
    type: (institution.type as "personal" | "business" | null) ?? null,
    country: institution.countries?.[0] ?? null,
  }));
}

export const institutionsRouter = createTRPCRouter({
  get: protectedProcedure.input(getInstitutionsSchema).query(async ({ input }) => {
    try {
      const results = await getInstitutions(undefined, {
        countryCode: input.countryCode,
        q: input.q,
        limit: input.limit,
        excludeProviders: input.excludeProviders,
      });

      const mapped = mapInstitutionRecords(results);

      if (mapped.length > 0) {
        return mapped;
      }

      try {
        const live = await fetchPlaidInstitutionsForSearch({
          countryCode: input.countryCode,
          q: input.q,
          limit: input.limit,
          excludeProviders: input.excludeProviders,
        });

        if (live.length > 0) {
          logger.info("Institution search used live Plaid fallback", {
            countryCode: input.countryCode,
            count: live.length,
          });
        }

        return live;
      } catch (liveError) {
        logger.warn("Live Plaid institution fallback failed", {
          countryCode: input.countryCode,
          error: liveError instanceof Error ? liveError.message : String(liveError),
        });
        return mapped;
      }
    } catch (error) {
      logger.error("Failed to get institutions", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to get institutions",
      });
    }
  }),

  getById: protectedProcedure.input(getInstitutionByIdSchema).query(async ({ input }) => {
    const result = await getInstitutionById(undefined, { id: input.id });

    if (!result) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Institution not found",
      });
    }

    return {
      id: result.id,
      name: result.name,
      logo: result.logo ?? null,
      provider: result.provider,
      availableHistory: result.availableHistory ?? null,
      maximumConsentValidity: result.maximumConsentValidity ?? null,
      popularity: result.popularity,
      type: (result.type as "personal" | "business" | null) ?? null,
      country: result.countries?.[0] ?? undefined,
    };
  }),

  updateUsage: protectedProcedure.input(updateUsageSchema).mutation(async ({ input }) => {
    try {
      const result = await updateInstitutionUsage(undefined, {
        id: input.id,
      });

      if (!result) {
        // Convex row missing (e.g. user picked an institution from live Plaid fallback).
        return { data: null };
      }

      return {
        data: {
          id: result.id,
          name: result.name,
          logo: result.logo ?? null,
          availableHistory: result.availableHistory ?? null,
          maximumConsentValidity: result.maximumConsentValidity ?? null,
          popularity: result.popularity,
          provider: result.provider,
          type: result.type ?? null,
          country: result.countries?.[0] ?? undefined,
        },
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      logger.error("Failed to update institution usage", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to update institution usage",
      });
    }
  }),
});
