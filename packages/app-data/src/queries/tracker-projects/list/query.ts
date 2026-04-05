import {
  getTaggedTrackerProjectsFromConvex,
  getTrackerProjectsFromConvex,
} from "@tamias/app-data-convex";
import type { Database } from "../../../client";
import { reuseQueryResult } from "../../../utils/request-cache";
import { enrichProjects } from "../enrich";
import type { GetTrackerProjectsParams } from "../types";
import {
  canUseIndexedTrackerProjectPage,
  getIndexedTrackerProjectsPage,
} from "./indexed-page";
import {
  matchesProjectSearch,
  paginate,
  serializeTrackerProjectListParams,
} from "./shared";
import { sortTrackerProjects } from "./sort";

async function getTrackerProjectsImpl(
  db: Database,
  params: GetTrackerProjectsParams,
) {
  const {
    teamId,
    sort,
    cursor,
    pageSize = 25,
    q,
    status,
    start,
    end,
    customers: customerIds,
    tags: tagIds,
  } = params;

  if (canUseIndexedTrackerProjectPage(sort)) {
    return getIndexedTrackerProjectsPage(db, params);
  }

  let projects = tagIds?.length
    ? await getTaggedTrackerProjectsFromConvex({
        teamId,
        tagIds,
        status: status ?? undefined,
      })
    : await getTrackerProjectsFromConvex({
        teamId,
        status: status ?? undefined,
      });

  if (status) {
    projects = projects.filter((project) => project.status === status);
  }

  if (start && end) {
    projects = projects.filter(
      (project) => project.createdAt >= start && project.createdAt <= end,
    );
  }

  if (customerIds?.length) {
    const customerSet = new Set(customerIds);
    projects = projects.filter(
      (project) => project.customerId && customerSet.has(project.customerId),
    );
  }

  projects = projects.filter((project) => matchesProjectSearch(project, q));

  const enriched = await enrichProjects(db, teamId, projects);
  const ordered = sortTrackerProjects(enriched, sort);

  return paginate(ordered, cursor, pageSize);
}

export const getTrackerProjects = reuseQueryResult({
  keyPrefix: "tracker-projects",
  keyFn: serializeTrackerProjectListParams,
  load: getTrackerProjectsImpl,
});
