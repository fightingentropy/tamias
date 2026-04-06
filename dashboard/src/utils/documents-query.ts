type DocumentFilter = {
  q?: string | null;
  tags?: string[] | null;
  start?: string | null;
  end?: string | null;
};

export function buildDocumentsQueryFilter(args: { filter: DocumentFilter; pageSize: number }) {
  return {
    ...args.filter,
    pageSize: args.pageSize,
  };
}
