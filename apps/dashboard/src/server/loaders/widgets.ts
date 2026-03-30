import "server-only";

import { TZDate } from "@date-fns/tz";
import {
  buildSuggestedActionsList,
  getSuggestedActionUsageFromConvex,
} from "@tamias/app-services/suggested-actions";
import {
  getContextualHydratableWidgetsData,
  getHydratableStandaloneWidgetsData,
  getOverviewWidgetsData,
  getWidgetPreferencesFromConvex,
} from "@tamias/app-services/widgets";
import type { WidgetType } from "@tamias/domain";
import { DEFAULT_WIDGET_PREFERENCES } from "@tamias/domain";
import {
  endOfDay,
  endOfWeek,
  formatISO,
  startOfDay,
  startOfWeek,
  subDays,
} from "date-fns";
import { cache } from "react";
import { measureServerRead } from "@/server/perf";
import { getCurrentSession, getRequestDb } from "./context";
import type { LocalSuggestedActions, LocalWidgetPreferences } from "./types";

export const getSuggestedActionsLocally = cache(
  async (limit: number): Promise<LocalSuggestedActions> => {
    return measureServerRead("getSuggestedActionsLocally", async () => {
      const session = await getCurrentSession();

      if (!session?.teamId || !session.user.convexId) {
        return buildSuggestedActionsList({
          allUsage: {},
          limit,
        });
      }

      const allUsage = await getSuggestedActionUsageFromConvex({
        teamId: session.teamId,
        userId: session.user.convexId,
      });

      return buildSuggestedActionsList({
        allUsage,
        limit,
      });
    });
  },
);

export const getCurrentWidgetPreferencesLocally = cache(
  async (): Promise<LocalWidgetPreferences> => {
    return measureServerRead("getCurrentWidgetPreferencesLocally", async () => {
      const session = await getCurrentSession();

      if (!session?.teamId || !session.user.convexId) {
        return DEFAULT_WIDGET_PREFERENCES;
      }

      return getWidgetPreferencesFromConvex({
        teamId: session.teamId,
        userId: session.user.convexId,
      });
    });
  },
);

export const getOverviewWidgetsLocally = cache(
  async (
    widgetsKey: string,
    from: string,
    to: string,
    currency: string | undefined,
    revenueType: "gross" | "net",
  ) => {
    return measureServerRead("getOverviewWidgetsLocally", async () => {
      const [session, requestDb] = await Promise.all([
        getCurrentSession(),
        getRequestDb(),
      ]);

      if (!session?.teamId) {
        return {};
      }

      const widgets = widgetsKey
        .split(",")
        .filter(Boolean) as WidgetType[];

      if (widgets.length === 0) {
        return {};
      }

      return getOverviewWidgetsData({
        db: requestDb,
        teamId: session.teamId,
        widgets,
        from,
        to,
        currency,
        revenueType,
      });
    });
  },
);

export const getHydratableStandaloneWidgetsLocally = cache(
  async (
    widgetsKey: string,
    from: string,
    to: string,
    currency: string | undefined,
    revenueType: "gross" | "net",
  ) => {
    return measureServerRead(
      "getHydratableStandaloneWidgetsLocally",
      async () => {
        const [session, requestDb] = await Promise.all([
          getCurrentSession(),
          getRequestDb(),
        ]);

        if (!session?.teamId) {
          return {};
        }

        const widgets = widgetsKey
          .split(",")
          .filter(Boolean) as WidgetType[];

        if (widgets.length === 0) {
          return {};
        }

        return getHydratableStandaloneWidgetsData({
          db: requestDb,
          teamId: session.teamId,
          widgets,
          from,
          to,
          currency,
          revenueType,
        });
      },
    );
  },
);

export function getContextualWidgetHydrationInputs(args: {
  timezone?: string | null;
  weekStartsOnMonday?: boolean | null;
  now?: Date;
}) {
  const baseNow = args.timezone
    ? new TZDate(args.now ?? new Date(), args.timezone)
    : (args.now ?? new Date());
  const weekStartsOn = args.weekStartsOnMonday ? 1 : 0;
  const inboxFrom = startOfDay(subDays(baseNow, 7));
  const inboxTo = endOfDay(baseNow);
  const trackedTimeFrom = startOfWeek(baseNow, {
    weekStartsOn,
  });
  const trackedTimeTo = endOfWeek(baseNow, {
    weekStartsOn,
  });

  return {
    inboxFrom: new Date(inboxFrom.getTime()).toISOString(),
    inboxTo: new Date(inboxTo.getTime()).toISOString(),
    trackedTimeFrom: formatISO(trackedTimeFrom, {
      representation: "date",
    }),
    trackedTimeTo: formatISO(trackedTimeTo, {
      representation: "date",
    }),
    billableDate: formatISO(baseNow, {
      representation: "date",
    }),
    weekStartsOnMonday: Boolean(args.weekStartsOnMonday),
  };
}

export const getContextualHydratableWidgetsLocally = cache(
  async (
    widgetsKey: string,
    currency: string | undefined,
    inboxFrom: string,
    inboxTo: string,
    trackedTimeFrom: string,
    trackedTimeTo: string,
    assignedId: string | undefined,
    billableDate: string,
    weekStartsOnMonday: boolean,
  ) => {
    return measureServerRead(
      "getContextualHydratableWidgetsLocally",
      async () => {
        const [session, requestDb] = await Promise.all([
          getCurrentSession(),
          getRequestDb(),
        ]);

        if (!session?.teamId) {
          return {};
        }

        const widgets = widgetsKey
          .split(",")
          .filter(Boolean) as WidgetType[];

        if (widgets.length === 0) {
          return {};
        }

        const effectiveAssignedId =
          assignedId ?? session.user.convexId ?? session.user.id;

        return getContextualHydratableWidgetsData({
          db: requestDb,
          teamId: session.teamId,
          widgets,
          currency,
          inboxFrom,
          inboxTo,
          trackedTimeFrom,
          trackedTimeTo,
          assignedId: effectiveAssignedId,
          billableDate,
          weekStartsOnMonday,
        });
      },
    );
  },
);
