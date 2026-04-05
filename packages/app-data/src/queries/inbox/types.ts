export type GetInboxParams = {
  teamId: string;
  cursor?: string | null;
  order?: string | null;
  sort?: string | null;
  pageSize?: number;
  q?: string | null;
  status?:
    | "new"
    | "archived"
    | "processing"
    | "done"
    | "pending"
    | "analyzing"
    | "suggested_match"
    | "no_match"
    | "other"
    | null;
  tab?: "all" | "other" | null;
};

export type GetInboxByIdParams = {
  id: string;
  teamId: string;
};

export type CheckInboxAttachmentsParams = {
  id: string;
  teamId: string;
};

export type GetInboxByFilePathParams = {
  filePath: string[];
  teamId: string;
};

export type GetStuckInboxItemsParams = {
  teamId: string;
  thresholdMinutes?: number;
};

export type GetExistingInboxAttachmentsByReferenceIdsParams = {
  referenceIds: string[];
  teamId: string;
};

export type GetInboxStatsParams = {
  teamId: string;
  from: string;
  to: string;
  currency?: string;
};
