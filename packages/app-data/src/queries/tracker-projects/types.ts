import type {
  CurrentUserIdentityRecord,
  TrackerProjectRecord,
} from "../../convex";

export type ConvexUserId = CurrentUserIdentityRecord["convexId"];

export type GetTrackerProjectsParams = {
  teamId: string;
  cursor?: string | null;
  pageSize?: number;
  q?: string | null;
  start?: string | null;
  end?: string | null;
  status?: "in_progress" | "completed" | null;
  customers?: string[] | null;
  tags?: string[] | null;
  sort?: string[] | null;
};

export type AssignedUser = {
  id: string;
  fullName: string;
  avatarUrl: string;
};

export type TrackerProjectTag = {
  id: string;
  name: string;
};

export type TrackerProjectListItem = TrackerProjectRecord & {
  totalDuration: number;
  totalAmount: number;
  customer: {
    id: string;
    name: string | null;
    website: string | null;
  } | null;
  team: {
    name: string | null;
  };
  tags: TrackerProjectTag[];
  users: AssignedUser[];
};

export type DeleteTrackerProjectParams = {
  teamId: string;
  id: string;
};

export type UpsertTrackerProjectParams = {
  id?: string;
  name: string;
  description?: string | null;
  estimate?: number | null;
  billable?: boolean | null;
  rate?: number | null;
  currency?: string | null;
  customerId?: string | null;
  teamId: string;
  userId?: ConvexUserId;
  tags?: { id: string; value: string }[] | null;
};

export type GetTrackerProjectByIdParams = {
  teamId: string;
  id: string;
};
