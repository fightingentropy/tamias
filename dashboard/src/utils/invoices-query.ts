type InvoiceFilter = {
  q?: string | null;
  statuses?: string[] | null;
  customers?: string[] | null;
  start?: string | null;
  end?: string | null;
  ids?: string[] | null;
  recurringIds?: string[] | null;
  recurring?: boolean | null;
};

export function buildInvoicesQueryFilter(args: {
  filter: InvoiceFilter;
  sort?: string[] | null;
}) {
  return {
    ...args.filter,
    sort: args.sort,
  };
}
