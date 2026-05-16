import type { Database } from "../../../client";
import { getCustomersByIdsFromD1, requireCustomersD1 } from "../../customers/d1";
import {
  getTrackerEntriesByProjectIdsFromD1,
  requireTrackerEntriesD1,
} from "../../tracker-entries/d1";
import { getTrackerProjectsFromD1, requireTrackerProjectsD1 } from "../../tracker-projects/d1";
import { isDefined } from "../shared";

export type UnbilledHoursDetail = {
  projectId: string;
  projectName: string;
  customerName?: string;
  hours: number;
  rate: number;
  currency: string;
  billableAmount: number;
};

export async function getUnbilledHoursDetails(
  db: Database,
  params: { teamId: string; currency?: string },
): Promise<UnbilledHoursDetail[]> {
  const { teamId, currency } = params;
  const projects = await getTrackerProjectsFromD1(requireTrackerProjectsD1(db), { teamId });
  const filteredProjects = currency
    ? projects.filter((project) => project.currency === currency)
    : projects;
  const entries = await getTrackerEntriesByProjectIdsFromD1(requireTrackerEntriesD1(db), {
    teamId,
    projectIds: filteredProjects.map((project) => project.id),
  });
  const customerIds = filteredProjects.map((project) => project.customerId).filter(isDefined);
  const customerRows = customerIds.length
    ? await getCustomersByIdsFromD1(requireCustomersD1(db), {
        teamId,
        customerIds: [...new Set(customerIds)],
      })
    : [];
  const customerNameById = new Map(customerRows.map((row) => [row.id, row.name]));
  const projectById = new Map(filteredProjects.map((project) => [project.id, project]));
  const totalsByProject = new Map<string, number>();

  for (const entry of entries) {
    if (!entry.projectId || entry.billed) {
      continue;
    }

    totalsByProject.set(
      entry.projectId,
      (totalsByProject.get(entry.projectId) ?? 0) + (entry.duration ?? 0),
    );
  }

  return [...totalsByProject.entries()]
    .flatMap(([projectId, totalSeconds]) => {
      const project = projectById.get(projectId);

      if (!project) {
        return [];
      }

      const hours = Math.round((totalSeconds / 3600) * 10) / 10;
      const rate = Number(project.rate ?? 0);
      const billableAmount = Math.round(hours * rate * 100) / 100;

      return [
        {
          projectId,
          projectName: project.name,
          customerName: project.customerId
            ? (customerNameById.get(project.customerId) ?? undefined)
            : undefined,
          hours,
          rate,
          currency: project.currency ?? "USD",
          billableAmount,
        },
      ];
    })
    .filter((row) => row.hours > 0)
    .sort((left, right) => right.billableAmount - left.billableAmount);
}
