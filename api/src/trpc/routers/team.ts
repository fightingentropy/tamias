import { createTRPCRouter } from "../init";
import { teamInviteProcedures } from "./team-invites";
import { teamLifecycleProcedures } from "./team-lifecycle";
import { teamMemberProcedures } from "./team-members";
import { teamReadProcedures } from "./team-reads";
import { teamSettingProcedures } from "./team-settings";

export const teamRouter = createTRPCRouter({
  ...teamReadProcedures,
  ...teamSettingProcedures,
  ...teamLifecycleProcedures,
  ...teamMemberProcedures,
  ...teamInviteProcedures,
});
