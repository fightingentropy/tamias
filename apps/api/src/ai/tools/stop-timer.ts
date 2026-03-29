import { db } from "@tamias/app-data/client";
import { stopTimer } from "@tamias/app-data/queries";
import type { CurrentUserIdentityRecord } from "@tamias/app-data-convex";
import { getAppUrl } from "@tamias/utils/envs";
import { formatDate } from "@tamias/utils/format";
import { tool } from "ai";
import { formatDistance } from "date-fns";
import { z } from "zod";
import { getToolAppContext, getToolTeamId } from "../utils/tool-runtime";

type ConvexUserId = CurrentUserIdentityRecord["convexId"];

const stopTimerSchema = z.object({
  entryId: z.string().nullable().optional().describe("Timer entry ID"),
  assignedId: z
    .string()
    .nullable()
    .optional()
    .describe("Assigned app user ID"),
});

export const stopTimerTool = tool({
  description:
    "Stop the current running timer - calculates and saves the duration.",
  inputSchema: stopTimerSchema,
  execute: async function* ({ entryId, assignedId }, executionOptions) {
    const appContext = getToolAppContext(executionOptions);
    const teamId = getToolTeamId(appContext);
    const userId =
      (assignedId as ConvexUserId | null | undefined) ||
      (appContext.convexUserId as ConvexUserId | undefined) ||
      null;

    if (!teamId) {
      yield {
        text: "Unable to stop timer: Team ID not found in context.",
      };

      return;
    }

    try {
      // Stop the timer
      const result = await stopTimer(db, {
        teamId,
        entryId: entryId || undefined,
        assignedId: userId,
      });

      // Handle discarded entries (under 60 seconds)
      if (result.discarded) {
        yield {
          text: `Timer discarded - entry was under 1 minute and was not saved.\n\n**Project:** ${result.project?.name || "Unknown"}`,
          link: {
            text: "View tracker",
            url: `${getAppUrl()}/tracker`,
          },
        };
        return;
      }

      const duration = result.duration ? Number(result.duration) : 0;
      const start = new Date(0);
      const end = new Date(duration * 1000);
      const formattedDuration = formatDistance(start, end, {
        includeSeconds: false,
      });

      const startTime = result.start
        ? formatDate(result.start, "HH:mm")
        : "N/A";
      const stopTime = result.stop ? formatDate(result.stop, "HH:mm") : "N/A";

      const response = `Timer stopped successfully!\n\n**Project:** ${result.project?.name || "Unknown"}\n**Duration:** ${formattedDuration}\n**Started:** ${startTime}\n**Stopped:** ${stopTime}\n**Description:** ${result.description || "None"}`;

      yield {
        text: response,
        link: {
          text: "View tracker",
          url: `${getAppUrl()}/tracker`,
        },
      };
    } catch (error) {
      yield {
        text: `Failed to stop timer: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  },
});
