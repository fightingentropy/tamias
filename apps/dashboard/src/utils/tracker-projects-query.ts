type TrackerProjectsFilter = {
  q?: string | null;
  customers?: string[] | null;
  status?: "in_progress" | "completed" | null;
  tags?: string[] | null;
  start?: string | null;
  end?: string | null;
};

export function buildTrackerProjectsQueryFilter(args: {
  filter: TrackerProjectsFilter;
  sort?: string[] | null;
  search?: string | null;
}) {
  return {
    ...args.filter,
    q: args.search ?? args.filter.q ?? null,
    sort: args.sort,
  };
}
