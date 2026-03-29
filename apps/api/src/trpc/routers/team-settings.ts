import {
  updateBaseCurrencySchema,
  updateTeamByIdSchema,
} from "../../schemas/team";
import { enqueue } from "@tamias/job-client";
import { updateTeamById } from "@tamias/app-data/queries";
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
    .mutation(async ({ ctx: { teamId }, input }) => {
      return enqueue(
        "update-base-currency",
        {
          teamId: teamId!,
          baseCurrency: input.baseCurrency,
        },
        "transactions",
        {
          publicTeamId: teamId!,
        },
      );
    }),
};
