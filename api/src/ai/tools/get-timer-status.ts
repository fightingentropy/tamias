import { db } from "@tamias/app-data/client";
import type { CurrentUserIdentityRecord } from "@tamias/app-data-convex";
import { getTimerStatus } from "@tamias/app-data/queries";
import { getAppUrl } from "@tamias/utils/envs";
import { formatDate } from "@tamias/utils/format";
import { tool } from "ai";
import { formatDistance } from "date-fns";
import { z } from "zod";
import { getToolAppContext, getToolTeamId } from "../utils/tool-runtime";

type ConvexUserId = CurrentUserIdentityRecord["convexId"];

const getTimerStatusSchema = z.object({
  assignedId: z.string().nullable().optional().describe("Assigned app user ID"),
});

export const getTimerStatusTool = tool({
  description: "Get current timer status - shows if timer is running and elapsed time.",
  inputSchema: getTimerStatusSchema,
  execute: async function* ({ assignedId }, executionOptions) {
    const appContext = getToolAppContext(executionOptions);
    const teamId = getToolTeamId(appContext);
    const userId =
      (assignedId as ConvexUserId | null | undefined) ||
      (appContext.convexUserId as ConvexUserId | undefined) ||
      null;

    if (!teamId) {
      yield {
        text: "Unable to get timer status: Team ID not found in context.",
      };
      return;
    }

    try {
      const status = await getTimerStatus(db, {
        teamId,
        assignedId: userId,
      });

      if (!status.isRunning || !status.currentEntry) {
        yield {
          text: "No timer is currently running.",
        };
        return;
      }

      const start = new Date(0);
      const end = new Date(status.elapsedTime * 1000);
      const formattedElapsed = formatDistance(start, end, {
        includeSeconds: false,
      });
      const startTime = status.currentEntry.start
        ? formatDate(status.currentEntry.start, "HH:mm")
        : "N/A";

      const response = `Timer is running!\n\n**Project:** ${status.currentEntry.trackerProject?.name || "Unknown"}\n**Started at:** ${startTime}\n**Elapsed time:** ${formattedElapsed}\n**Description:** ${status.currentEntry.description || "None"}`;

      yield {
        text: response,
        link: {
          text: "View tracker",
          url: `${getAppUrl()}/tracker`,
        },
      };
    } catch (error) {
      yield {
        text: `Failed to get timer status: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  },
});
