import { apiKeysRouter } from "../api-keys";
import { appsRouter } from "../apps";
import { asyncRunsRouter } from "../async-runs";
import { institutionsRouter } from "../institutions";
import { oauthApplicationsRouter } from "../oauth-applications";
import { shortLinksRouter } from "../short-links";
import { trackerEntriesRouter } from "../tracker-entries";
import { trackerProjectsRouter } from "../tracker-projects";

export const miscRouters = {
  apiKeys: apiKeysRouter,
  apps: appsRouter,
  asyncRuns: asyncRunsRouter,
  institutions: institutionsRouter,
  oauthApplications: oauthApplicationsRouter,
  shortLinks: shortLinksRouter,
  trackerEntries: trackerEntriesRouter,
  trackerProjects: trackerProjectsRouter,
};
