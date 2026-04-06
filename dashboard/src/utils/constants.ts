import { getSupportEmail } from "@tamias/utils/envs";

export const Cookies = {
  PreferredSignInProvider: "preferred-signin-provider",
  InboxFilter: "inbox-filter-v2",
  InboxOrder: "inbox-order",

  LastProject: "last-project",
  WeeklyCalendar: "weekly-calendar",
};

export const LocalStorageKeys = {
  MatchLearningToastSeen: "match-learning-toast-seen",
  MetricsFilter: "metrics-filter-preferences",
};

export const SUPPORT_EMAIL = getSupportEmail();
