export const DEFAULT_PAGE_SIZE = 250;

type CursorPageResult<T> = {
  page: T[];
  isDone: boolean;
  continueCursor: string | null;
};

export async function collectCursorPages<T>(
  loadPage: (cursor: string | null) => Promise<CursorPageResult<T>>,
) {
  const records: T[] = [];
  let cursor: string | null = null;

  while (true) {
    const result = await loadPage(cursor);
    records.push(...result.page);

    if (result.isDone) {
      return records;
    }

    cursor = result.continueCursor;
  }
}
