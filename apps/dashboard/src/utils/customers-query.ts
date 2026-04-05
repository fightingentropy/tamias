type CustomerFilter = {
  q?: string | null;
  sort?: string[] | null;
  start?: string | null;
  end?: string | null;
};

export function buildCustomersQueryFilter(args: {
  filter: CustomerFilter;
  sort?: string[] | null;
  search?: string | null;
}) {
  return {
    ...args.filter,
    sort: args.sort,
    q: args.search ?? args.filter.q ?? null,
  };
}
