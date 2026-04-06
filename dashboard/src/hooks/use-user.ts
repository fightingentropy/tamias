"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  USER_QUERY_REFETCH_INTERVAL_MS,
  USER_QUERY_STALE_TIME_MS,
  useOptionalCurrentUser,
} from "@/components/current-user-provider";
import { useTRPC } from "@/trpc/client";

export function useUserQuery() {
  const trpc = useTRPC();
  const currentUser = useOptionalCurrentUser();
  // useQuery instead of useSuspenseQuery so components outside a Suspense
  // boundary don't blank the page during hydration. Data is always
  // pre-fetched by the (sidebar) layout which awaits user.me.
  const result = useQuery({
    ...trpc.user.me.queryOptions(),
    initialData: currentUser ?? undefined,
    enabled: !currentUser,
    subscribed: !currentUser,
    staleTime: USER_QUERY_STALE_TIME_MS,
    refetchInterval: USER_QUERY_REFETCH_INTERVAL_MS,
    refetchOnWindowFocus: false,
  });

  return {
    ...result,
    data: (currentUser ?? result.data) as NonNullable<typeof result.data>,
    isFetching: currentUser ? false : result.isFetching,
    isLoading: currentUser ? false : result.isLoading,
    isPending: currentUser ? false : result.isPending,
  } as typeof result & { data: NonNullable<typeof result.data> };
}

export function useUserMutation() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.user.update.mutationOptions({
      onMutate: async (newData) => {
        // Cancel outgoing refetches
        await queryClient.cancelQueries({
          queryKey: trpc.user.me.queryKey(),
        });

        // Get current data
        const previousData = queryClient.getQueryData(trpc.user.me.queryKey());

        // Optimistically update
        queryClient.setQueryData(trpc.user.me.queryKey(), (old: any) => ({
          ...old,
          ...newData,
        }));

        return { previousData };
      },
      onError: (_, __, context) => {
        // Rollback on error
        queryClient.setQueryData(trpc.user.me.queryKey(), context?.previousData);
      },
      onSettled: () => {
        // Refetch after error or success
        queryClient.invalidateQueries({
          queryKey: trpc.user.me.queryKey(),
        });
      },
    }),
  );
}
