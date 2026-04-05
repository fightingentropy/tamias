import { loadDocumentFilterParams } from "@/hooks/use-document-filter-params";
import { batchPrefetch, trpc } from "@/trpc/server";
import { getInitialTableSettings } from "@/utils/columns";
import { buildDocumentsQueryFilter } from "@/utils/documents-query";
import {
  buildBaseAppShellState,
  dehydrateQueryClient,
  getRequestUrl,
} from "@/start/server/route-data/shared";

export async function buildVaultPageData(href?: string) {
  const { queryClient, user } = await buildBaseAppShellState();
  const requestUrl = getRequestUrl(href);
  const filter = loadDocumentFilterParams(requestUrl.searchParams);
  const initialSettings = await getInitialTableSettings("vault");
  const documentsQuery = trpc.documents.get.infiniteQueryOptions(
    buildDocumentsQueryFilter({
      filter,
      pageSize: 24,
    }),
    {
      getNextPageParam: ({ meta }) => meta?.cursor,
    },
  );

  await batchPrefetch([documentsQuery]);

  return {
    dehydratedState: dehydrateQueryClient(queryClient),
    user,
    initialSettings,
  };
}
