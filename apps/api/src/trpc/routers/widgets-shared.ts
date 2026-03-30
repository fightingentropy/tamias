import type { CurrentUserIdentityRecord } from "@tamias/app-data-convex";
import type { Session } from "@tamias/auth-session";

type ConvexUserId = CurrentUserIdentityRecord["convexId"];

export function getWidgetAssignedUserId(session: Session): ConvexUserId {
  return session.user.convexId ?? session.user.id;
}

export function requireWidgetConvexUserId(session: Session): ConvexUserId {
  if (!session.user.convexId) {
    throw new Error("Missing Convex user id");
  }

  return session.user.convexId;
}
