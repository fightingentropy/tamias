import type { Database } from "../../client";
import { createActivity } from "../activities";
import { getTrackerProjectById } from "./by-id";
import {
  deleteTrackerProjectFromD1,
  replaceTrackerProjectTagsInD1,
  requireTrackerProjectsD1,
  upsertTrackerProjectInD1,
} from "./d1";
import type { DeleteTrackerProjectParams, UpsertTrackerProjectParams } from "./types";

export async function deleteTrackerProject(db: Database, params: DeleteTrackerProjectParams) {
  return deleteTrackerProjectFromD1(requireTrackerProjectsD1(db), {
    teamId: params.teamId,
    id: params.id,
  });
}

export async function upsertTrackerProject(db: Database, params: UpsertTrackerProjectParams) {
  const projectId = params.id ?? crypto.randomUUID();

  await upsertTrackerProjectInD1(requireTrackerProjectsD1(db), {
    id: projectId,
    teamId: params.teamId,
    name: params.name,
    description: params.description,
    customerId: params.customerId,
    estimate: params.estimate,
    billable: params.billable,
    currency: params.currency,
    rate: params.rate,
  });

  if (!params.id) {
    createActivity(db, {
      teamId: params.teamId,
      userId: params.userId,
      type: "tracker_project_created",
      source: "user",
      priority: 7,
      metadata: {
        projectId,
        name: params.name,
        description: params.description || null,
        billable: params.billable || false,
        rate: params.rate || null,
        currency: params.currency || null,
        customerId: params.customerId || null,
        estimate: params.estimate || null,
      },
    });
  }

  if (params.tags) {
    await replaceTrackerProjectTagsInD1(requireTrackerProjectsD1(db), {
      teamId: params.teamId,
      trackerProjectId: projectId,
      tagIds: params.tags.map((tag) => tag.id),
    });
  }

  return getTrackerProjectById(db, {
    teamId: params.teamId,
    id: projectId,
  });
}
