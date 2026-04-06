import type { z } from "@hono/zod-openapi";
import type { Database } from "@tamias/app-data/client";
import {
  getCustomerById,
  getInvoiceRecurringById,
  getScheduledInvoicesForRecurring,
  updateInvoice,
} from "@tamias/app-data/queries";
import type { Session } from "@tamias/auth-session";
import { createLoggerWithContext } from "@tamias/logger";
import { TRPCError } from "@trpc/server";
import { removeInvoiceJob } from "../../invoice/transport";
import type { updateInvoiceRecurringSchema } from "../../schemas/invoice-recurring";

export const invoiceRecurringLogger = createLoggerWithContext("trpc:invoice-recurring");

type UpdateInvoiceRecurringInput = z.infer<typeof updateInvoiceRecurringSchema>;

const dayOfWeekFrequencies = ["weekly", "biweekly", "monthly_weekday"] as const;
const dayOfMonthFrequencies = ["monthly_date", "quarterly", "semi_annual", "annual"] as const;
const frequenciesRequiringDay = [...dayOfWeekFrequencies, ...dayOfMonthFrequencies] as const;

export function requireInvoiceRecurringTeamId(teamId?: string): string {
  if (!teamId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Team context required",
    });
  }

  return teamId;
}

export function requireInvoiceRecurringContext(args: {
  teamId?: string;
  userId?: Session["user"]["id"];
}) {
  if (!args.teamId || !args.userId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Team and user context required",
    });
  }

  return {
    teamId: args.teamId,
    userId: args.userId,
  };
}

export async function assertRecurringCustomerCanReceiveInvoices(
  db: Database,
  teamId: string,
  customerId: string,
) {
  const customer = await getCustomerById(db, {
    id: customerId,
    teamId,
  });

  if (!customer) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Customer not found",
    });
  }

  const customerEmail = customer.billingEmail || customer.email;

  if (!customerEmail) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "Customer must have an email address to receive recurring invoices. Please add an email to the customer profile.",
    });
  }

  return customer;
}

export async function validateInvoiceRecurringUpdateInput(
  db: Database,
  teamId: string,
  input: UpdateInvoiceRecurringInput,
) {
  const needsCrossFieldValidation =
    (input.frequencyDay !== undefined &&
      input.frequencyDay !== null &&
      input.frequency === undefined) ||
    (input.frequency !== undefined && input.frequencyDay === undefined) ||
    (input.frequency !== undefined &&
      frequenciesRequiringDay.includes(
        input.frequency as (typeof frequenciesRequiringDay)[number],
      ) &&
      input.frequencyDay === null) ||
    (input.frequencyWeek !== undefined &&
      input.frequencyWeek !== null &&
      input.frequency === undefined) ||
    (input.frequency === "monthly_weekday" && input.frequencyWeek === undefined) ||
    (input.frequencyWeek === null && input.frequency === undefined) ||
    (input.frequencyInterval === null && input.frequency === undefined) ||
    (input.endDate === null && input.endType === undefined) ||
    (input.endCount === null && input.endType === undefined);

  if (needsCrossFieldValidation) {
    const existing = await getInvoiceRecurringById(db, {
      id: input.id,
      teamId,
    });

    if (!existing) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Recurring invoice series not found",
      });
    }

    const effectiveFrequency = input.frequency ?? existing.frequency;
    const effectiveFrequencyDay =
      input.frequencyDay === undefined ? existing.frequencyDay : input.frequencyDay;
    const effectiveFrequencyWeek =
      input.frequencyWeek === undefined ? existing.frequencyWeek : input.frequencyWeek;

    if (
      input.frequencyDay === null &&
      frequenciesRequiringDay.includes(
        effectiveFrequency as (typeof frequenciesRequiringDay)[number],
      )
    ) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `frequencyDay is required for ${effectiveFrequency} frequency and cannot be null`,
      });
    }

    if (effectiveFrequency === "monthly_weekday" && effectiveFrequencyWeek === null) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "frequencyWeek is required for monthly_weekday frequency and cannot be null",
      });
    }

    if (effectiveFrequencyDay !== null && effectiveFrequencyDay !== undefined) {
      if (
        dayOfWeekFrequencies.includes(
          effectiveFrequency as (typeof dayOfWeekFrequencies)[number],
        ) &&
        effectiveFrequencyDay > 6
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `For ${effectiveFrequency} frequency, frequencyDay must be 0-6 (Sunday-Saturday)`,
        });
      }

      if (
        dayOfMonthFrequencies.includes(
          effectiveFrequency as (typeof dayOfMonthFrequencies)[number],
        ) &&
        (effectiveFrequencyDay < 1 || effectiveFrequencyDay > 31)
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `For ${effectiveFrequency} frequency, frequencyDay must be 1-31 (day of month)`,
        });
      }
    }

    if (
      effectiveFrequency === "monthly_weekday" &&
      effectiveFrequencyWeek !== null &&
      effectiveFrequencyWeek !== undefined &&
      (effectiveFrequencyWeek < 1 || effectiveFrequencyWeek > 5)
    ) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "For monthly_weekday frequency, frequencyWeek must be 1-5 (1st through 5th occurrence)",
      });
    }

    if (input.frequencyInterval === null && effectiveFrequency === "custom") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "frequencyInterval is required for custom frequency and cannot be null",
      });
    }

    const effectiveEndType = input.endType ?? existing.endType;

    if (input.endDate === null && effectiveEndType === "on_date") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "endDate is required when endType is 'on_date' and cannot be null",
      });
    }

    if (input.endCount === null && effectiveEndType === "after_count") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "endCount is required when endType is 'after_count' and cannot be null",
      });
    }
  }

  if (input.customerId !== undefined) {
    await assertRecurringCustomerCanReceiveInvoices(db, teamId, input.customerId);
  }
}

export async function clearScheduledRecurringInvoices(
  db: Database,
  teamId: string,
  invoiceRecurringId: string,
) {
  const scheduledInvoices = await getScheduledInvoicesForRecurring(db, {
    teamId,
    invoiceRecurringId,
  });
  const scheduledRunIdsToRemove = scheduledInvoices
    .map((invoice) => invoice.scheduledJobId)
    .filter((scheduledJobId): scheduledJobId is string => !!scheduledJobId);

  await Promise.all(
    scheduledInvoices.map((invoice) =>
      updateInvoice(db, {
        id: invoice.id,
        teamId,
        status: "draft",
        scheduledAt: null,
        scheduledJobId: null,
      }),
    ),
  );

  await Promise.all(
    scheduledRunIdsToRemove.map((scheduledRunId) => removeInvoiceJob(scheduledRunId)),
  );
}
