export type GetInvoicesParams = {
  teamId: string;
  cursor?: string | null;
  pageSize?: number;
  q?: string | null;
  statuses?: string[] | null;
  customers?: string[] | null;
  start?: string | null;
  end?: string | null;
  sort?: string[] | null;
  ids?: string[] | null;
  recurringIds?: string[] | null;
  recurring?: boolean | null;
};

export type GetInvoiceByIdParams = {
  id: string;
  teamId?: string;
};

export type GetInvoiceSummaryParams = {
  teamId: string;
  statuses?: (
    | "paid"
    | "canceled"
    | "overdue"
    | "unpaid"
    | "draft"
    | "scheduled"
  )[];
};
