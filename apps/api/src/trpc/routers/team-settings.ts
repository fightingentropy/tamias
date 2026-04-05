import {
  updateBaseCurrencySchema,
  updateTeamByIdSchema,
} from "../../schemas/team";
import { enqueue } from "@tamias/job-client";
import {
  getTeamById,
  refreshTeamBaseCurrencyData,
  updateTeamById,
} from "@tamias/app-data/queries";
import {
  createAsyncRunInConvex,
  updateAsyncRunInConvex,
} from "@tamias/app-data/convex";
import { protectedProcedure } from "../init";

export const teamSettingProcedures = {
  update: protectedProcedure
    .input(updateTeamByIdSchema)
    .mutation(async ({ ctx: { db, teamId }, input }) => {
      return updateTeamById(db, {
        id: teamId!,
        data: input,
      });
    }),

  updateBaseCurrency: protectedProcedure
    .input(updateBaseCurrencySchema)
    .mutation(async ({ ctx: { db, teamId }, input }) => {
      const normalizedBaseCurrency = input.baseCurrency.toUpperCase();
      const team = await getTeamById(db, teamId!);

      if ((team?.baseCurrency ?? "").toUpperCase() === normalizedBaseCurrency) {
        const asyncRun = await createAsyncRunInConvex({
          publicTeamId: teamId!,
          provider: "cloudflare-queue",
          kind: "job",
          status: "active",
          providerQueueName: "transactions",
          providerJobName: "update-base-currency",
          progress: 5,
          progressStep: "Refreshing base currency data",
          startedAt: new Date().toISOString(),
          metadata: {
            mode: "synchronous-refresh",
          },
        });

        try {
          const result = await refreshTeamBaseCurrencyData(db, {
            teamId: teamId!,
            baseCurrency: normalizedBaseCurrency,
          });

          await updateAsyncRunInConvex({
            runId: asyncRun.id,
            status: "completed",
            progress: 100,
            progressStep: "Completed",
            result,
            completedAt: new Date().toISOString(),
          });
        } catch (error) {
          await updateAsyncRunInConvex({
            runId: asyncRun.id,
            status: "failed",
            error: error instanceof Error ? error.message : String(error),
            completedAt: new Date().toISOString(),
          });
          throw error;
        }

        return {
          runId: asyncRun.id,
        };
      }

      return enqueue(
        "update-base-currency",
        {
          teamId: teamId!,
          baseCurrency: normalizedBaseCurrency,
        },
        "transactions",
        {
          publicTeamId: teamId!,
        },
      );
    }),
};
