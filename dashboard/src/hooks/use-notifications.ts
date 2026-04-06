"use client";

import type { AppRouter } from "@tamias/trpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTRPC } from "@/trpc/client";

// Infer types from tRPC router
type RouterOutputs = inferRouterOutputs<AppRouter>;
type RouterInputs = inferRouterInputs<AppRouter>;
type NotificationsList = RouterOutputs["notifications"]["list"];
type NotificationsData = NotificationsList["data"];

// Use the natural tRPC types without modification
export type Activity = NotificationsData[number];

type UpdateStatusInput = RouterInputs["notifications"]["updateStatus"];
type UpdateAllStatusInput = RouterInputs["notifications"]["updateAllStatus"];

type UseNotificationsOptions = {
  isOpen?: boolean;
};

function getInitialPageVisibility() {
  if (typeof document === "undefined") {
    return true;
  }

  return document.visibilityState === "visible";
}

// Utility functions to safely handle metadata without excessive casting
export function getMetadata(activity: Activity): Record<string, any> {
  return (activity.metadata as Record<string, any>) || {};
}

export function getMetadataProperty(activity: Activity, key: string): any {
  const metadata = getMetadata(activity);
  return metadata[key];
}

// Get ISO timestamp for 24 hours ago
function _get24HoursAgo(): string {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
}

export function useNotifications(options: UseNotificationsOptions = {}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { isOpen = false } = options;
  const [isPageVisible, setIsPageVisible] = useState(getInitialPageVisibility);

  useEffect(() => {
    const updateVisibility = () => {
      setIsPageVisible(document.visibilityState === "visible");
    };

    updateVisibility();
    document.addEventListener("visibilitychange", updateVisibility);

    return () => {
      document.removeEventListener("visibilitychange", updateVisibility);
    };
  }, []);

  const {
    data: activitiesData,
    isLoading,
    error,
  } = useQuery({
    ...trpc.notifications.list.queryOptions({
      maxPriority: 3, // Only fetch notifications (priority <= 3)
      pageSize: 20,
      status: ["unread", "read"], // Exclude archived notifications from query
    }),
    staleTime: 60_000,
    refetchInterval: isOpen && isPageVisible ? 10_000 : false,
    refetchOnWindowFocus: true,
  });

  // Separate query for archived notifications
  const { data: archivedActivitiesData, isLoading: archivedIsLoading } = useQuery({
    ...trpc.notifications.list.queryOptions({
      maxPriority: 3,
      pageSize: 20,
      status: "archived", // Only archived notifications
    }),
    enabled: isOpen,
    staleTime: 60_000,
    refetchInterval: isOpen && isPageVisible ? 30_000 : false,
    refetchOnWindowFocus: true,
  });

  // Mutations
  const updateStatusMutation = useMutation(
    trpc.notifications.updateStatus.mutationOptions({
      onMutate: async (variables: UpdateStatusInput) => {
        // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
        await queryClient.cancelQueries({
          queryKey: trpc.notifications.list.queryKey(),
        });

        // Define query keys for both inbox and archived
        const inboxQueryKey = trpc.notifications.list.queryKey({
          maxPriority: 3,
          pageSize: 20,
          status: ["unread", "read"],
        });

        const archivedQueryKey = trpc.notifications.list.queryKey({
          maxPriority: 3,
          pageSize: 20,
          status: "archived",
        });

        // Snapshot both query states
        const previousInboxData = queryClient.getQueryData<NotificationsList>(inboxQueryKey);
        const previousArchivedData = queryClient.getQueryData<NotificationsList>(archivedQueryKey);

        if (variables.status === "archived") {
          // Moving from inbox to archived
          let notificationToMove: Activity | null = null;

          // Remove from inbox
          queryClient.setQueryData<NotificationsList>(inboxQueryKey, (old) => {
            if (!old?.data) return old;

            const filteredData = old.data.filter((notification) => {
              if (notification.id === variables.activityId) {
                notificationToMove = { ...notification, status: "archived" };
                return false;
              }
              return true;
            });

            return { ...old, data: filteredData };
          });

          // Add to archived (if we found the notification)
          if (notificationToMove) {
            queryClient.setQueryData<NotificationsList>(archivedQueryKey, (old) => {
              if (!old?.data)
                return {
                  data: [notificationToMove!],
                  meta: old?.meta || {
                    cursor: null,
                    hasPreviousPage: false,
                    hasNextPage: false,
                  },
                };
              return { ...old, data: [notificationToMove!, ...old.data] };
            });
          }
        } else {
          // For other status changes (like unread -> read), just update the inbox
          queryClient.setQueryData<NotificationsList>(inboxQueryKey, (old) => {
            if (!old?.data) return old;

            return {
              ...old,
              data: old.data.map((notification) =>
                notification.id === variables.activityId
                  ? { ...notification, status: variables.status }
                  : notification,
              ),
            };
          });
        }

        // Return context for rollback
        return {
          previousInboxData,
          previousArchivedData,
          inboxQueryKey,
          archivedQueryKey,
        };
      },
      onError: (_, __, context) => {
        // Rollback both queries if mutation fails
        if (context?.previousInboxData) {
          queryClient.setQueryData(context.inboxQueryKey, context.previousInboxData);
        }
        if (context?.previousArchivedData) {
          queryClient.setQueryData(context.archivedQueryKey, context.previousArchivedData);
        }
      },
    }),
  );

  const updateAllStatusMutation = useMutation(
    trpc.notifications.updateAllStatus.mutationOptions({
      onMutate: async (variables: UpdateAllStatusInput) => {
        // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
        await queryClient.cancelQueries({
          queryKey: trpc.notifications.list.queryKey(),
        });

        // Define query keys for both inbox and archived
        const inboxQueryKey = trpc.notifications.list.queryKey({
          maxPriority: 3,
          pageSize: 20,
          status: ["unread", "read"],
        });

        const archivedQueryKey = trpc.notifications.list.queryKey({
          maxPriority: 3,
          pageSize: 20,
          status: "archived",
        });

        // Snapshot both query states
        const previousInboxData = queryClient.getQueryData<NotificationsList>(inboxQueryKey);
        const previousArchivedData = queryClient.getQueryData<NotificationsList>(archivedQueryKey);

        if (variables.status === "archived") {
          // Moving all inbox notifications to archived
          let notificationsToMove: Activity[] = [];

          // Clear inbox and collect notifications to move
          queryClient.setQueryData<NotificationsList>(inboxQueryKey, (old) => {
            if (!old?.data) return old;

            notificationsToMove = old.data.map((notification) => ({
              ...notification,
              status: "archived" as const,
            }));

            return { ...old, data: [] };
          });

          // Add all to archived
          if (notificationsToMove.length > 0) {
            queryClient.setQueryData<NotificationsList>(archivedQueryKey, (old) => {
              if (!old?.data)
                return {
                  data: notificationsToMove,
                  meta: old?.meta || {
                    cursor: null,
                    hasPreviousPage: false,
                    hasNextPage: false,
                  },
                };
              return { ...old, data: [...notificationsToMove, ...old.data] };
            });
          }
        } else if (variables.status === "read") {
          // Update all unread to read in inbox (don't move between queries)
          queryClient.setQueryData<NotificationsList>(inboxQueryKey, (old) => {
            if (!old?.data) return old;

            return {
              ...old,
              data: old.data.map((notification) => ({
                ...notification,
                status: variables.status,
              })),
            };
          });
        }

        // Return context for rollback
        return {
          previousInboxData,
          previousArchivedData,
          inboxQueryKey,
          archivedQueryKey,
        };
      },
      onError: (_, __, context) => {
        // Rollback both queries if mutation fails
        if (context?.previousInboxData) {
          queryClient.setQueryData(context.inboxQueryKey, context.previousInboxData);
        }
        if (context?.previousArchivedData) {
          queryClient.setQueryData(context.archivedQueryKey, context.previousArchivedData);
        }
      },
    }),
  );

  // Return notification activities directly without transformation
  const notifications = activitiesData?.data || [];
  const archivedNotifications = archivedActivitiesData?.data || [];

  // Mark a single message as read (archived)
  const markMessageAsRead = useCallback(
    (messageId: string) => {
      updateStatusMutation.mutate({
        activityId: messageId,
        status: "archived",
      });
    },
    [updateStatusMutation],
  );

  // Mark all messages as read (archived)
  const markAllMessagesAsRead = useCallback(() => {
    updateAllStatusMutation.mutate({
      status: "archived",
    });
  }, [updateAllStatusMutation]);

  // Mark all messages as seen (read)
  const markAllMessagesAsSeen = useCallback(() => {
    updateAllStatusMutation.mutate({
      status: "read",
    });
  }, [updateAllStatusMutation]);

  const hasUnseenNotifications = useMemo(
    () => notifications.some((notification) => notification.status === "unread"),
    [notifications],
  );

  return {
    isLoading: isLoading || (isOpen && archivedIsLoading),
    error,
    notifications, // Main notifications (unread/read) - already filtered by query
    archived: archivedNotifications, // Archived notifications from separate query
    hasUnseenNotifications,
    markMessageAsRead,
    markAllMessagesAsRead,
    markAllMessagesAsSeen,
  };
}
