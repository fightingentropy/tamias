import { DeleteTeamProcessor } from "./delete-team";
import { InviteTeamMembersProcessor } from "./invite-team-members";
import { PaymentIssueProcessor } from "./payment-issue";

/**
 * Export all team processors (for type imports)
 */
export { DeleteTeamProcessor } from "./delete-team";
export { InviteTeamMembersProcessor } from "./invite-team-members";
export { PaymentIssueProcessor } from "./payment-issue";

/**
 * Team processor registry
 * Maps job names to processor instances
 */
export const teamProcessors = {
  "delete-team": new DeleteTeamProcessor(),
  "invite-team-members": new InviteTeamMembersProcessor(),
  "payment-issue": new PaymentIssueProcessor(),
};
