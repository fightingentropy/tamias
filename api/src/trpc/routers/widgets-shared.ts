import type { Session } from "@tamias/auth-session";

type AppUserId = string;

export function getWidgetAssignedUserId(session: Session): AppUserId {
  return session.user.id ?? session.user.id;
}

export function requireWidgetUserId(session: Session): AppUserId {
  if (!session.user.id) {
    throw new Error("Missing user id");
  }

  return session.user.id;
}
