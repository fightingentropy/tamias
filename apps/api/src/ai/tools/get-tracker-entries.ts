import { db } from "@tamias/app-data/client";
import { getTrackerRecordsByRange } from "@tamias/app-data/queries";
import type { CurrentUserIdentityRecord } from "@tamias/app-data/convex";
import { getAppUrl } from "@tamias/utils/envs";
import { formatDate } from "@tamias/utils/format";
import { tool } from "ai";
import { formatDistance } from "date-fns";
import { z } from "zod";
import { getToolAppContext, getToolTeamId } from "../utils/tool-runtime";

type ConvexUserId = CurrentUserIdentityRecord["convexId"];

const getTrackerEntriesSchema = z.object({
  from: z.string().describe("Start date (ISO 8601)"),
  to: z.string().describe("End date (ISO 8601)"),
  projectId: z.string().nullable().optional().describe("Project ID"),
  userId: z.string().nullable().optional().describe("Assigned app user ID"),
});

export const getTrackerEntriesTool = tool({
  description:
    "Retrieve tracker entries (time entries) within a date range with filtering by project or user.",
  inputSchema: getTrackerEntriesSchema,
  execute: async function* ({ from, to, projectId, userId }, executionOptions) {
    const appContext = getToolAppContext(executionOptions);
    const teamId = getToolTeamId(appContext);

    if (!teamId) {
      yield {
        text: "Unable to retrieve tracker entries: Team ID not found in context.",
      };
      return;
    }

    try {
      const params = {
        teamId,
        from,
        to,
        projectId: projectId ?? undefined,
        userId: (userId as ConvexUserId | null | undefined) ?? undefined,
      };

      const result = await getTrackerRecordsByRange(db, params);

      // Flatten the grouped entries
      const allEntries = Object.values(result.result).flat();

      if (allEntries.length === 0) {
        yield { text: "No tracker entries found matching your criteria." };
        return;
      }

      const formattedEntries = allEntries.map((entry) => {
        const start = new Date(0);
        const end = new Date((entry.duration ?? 0) * 1000);
        const formattedDuration = formatDistance(start, end, {
          includeSeconds: false,
        });
        const projectName = entry.trackerProject?.name || "No project";
        const assignedName = entry.user?.fullName || "Unassigned";
        const description = entry.description || "No description";

        return {
          id: entry.id,
          date: formatDate(entry.date || ""),
          projectName,
          duration: formattedDuration,
          description,
          assignedName,
        };
      });

      const totalDuration = result.meta.totalDuration;
      const start = new Date(0);
      const end = new Date(totalDuration * 1000);
      const formattedTotalDuration = formatDistance(start, end, {
        includeSeconds: false,
      });

      const response = `| Date | Project | Duration | Description | Assigned |\n|------|---------|----------|-------------|----------|\n${formattedEntries.map((e) => `| ${e.date} | ${e.projectName} | ${e.duration} | ${e.description} | ${e.assignedName} |`).join("\n")}\n\n**${allEntries.length} entries** | Total Duration: ${formattedTotalDuration}`;

      yield {
        text: response,
        link: {
          text: "View all time entries",
          url: `${getAppUrl()}/tracker`,
        },
      };
    } catch (error) {
      yield {
        text: `Failed to retrieve tracker entries: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  },
});
