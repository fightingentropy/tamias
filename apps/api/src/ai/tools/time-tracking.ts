import { createTrackerEntryTool } from "./create-tracker-entry";
import { getTimerStatusTool } from "./get-timer-status";
import { getTrackerEntriesTool } from "./get-tracker-entries";
import { getTrackerProjectsTool } from "./get-tracker-projects";
import { stopTimerTool } from "./stop-timer";

export {
  createTrackerEntryTool,
  getTimerStatusTool,
  getTrackerEntriesTool,
  getTrackerProjectsTool,
  stopTimerTool,
};

export const timeTrackingTools = {
  getTrackerProjects: getTrackerProjectsTool,
  getTrackerEntries: getTrackerEntriesTool,
  createTrackerEntry: createTrackerEntryTool,
  stopTimer: stopTimerTool,
  getTimerStatus: getTimerStatusTool,
} as const;
