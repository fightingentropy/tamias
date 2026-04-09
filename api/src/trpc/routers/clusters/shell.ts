// App-shell routers — needed for authenticated UI but NOT for initial
// auth queries (user.me, team.current). Deferred to first non-auth
// procedure to avoid loading billing/Polar, search/AI SDK, widgets/finance
// on cold starts that only need the user+team routers.

import { billingRouter } from "../billing";
import { notificationSettingsRouter } from "../notification-settings";
import { notificationsRouter } from "../notifications";
import { searchRouter } from "../search";
import { suggestedActionsRouter } from "../suggested-actions";
import { supportRouter } from "../support";
import { tagsRouter } from "../tags";
import { widgetsRouter } from "../widgets";

export const shellRouters = {
  billing: billingRouter,
  notifications: notificationsRouter,
  notificationSettings: notificationSettingsRouter,
  search: searchRouter,
  suggestedActions: suggestedActionsRouter,
  support: supportRouter,
  tags: tagsRouter,
  widgets: widgetsRouter,
};
