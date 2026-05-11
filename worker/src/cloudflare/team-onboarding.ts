import { getBankConnections, getTeamById, getUserByEmail } from "@tamias/app-data/queries";
import { TrialActivationEmail } from "@tamias/email/emails/trial-activation";
import { TrialDeactivatedEmail } from "@tamias/email/emails/trial-deactivated";
import { TrialEndedEmail } from "@tamias/email/emails/trial-ended";
import { TrialExpiringEmail } from "@tamias/email/emails/trial-expiring";
import { WelcomeEmail } from "@tamias/email/emails/welcome";
import { render } from "@tamias/email/render";
import { sendEmail } from "@tamias/email/send";
import { getSupportFromDisplay, getSupportReplyToEmail } from "@tamias/utils/envs";
import { getDb } from "../utils/db";

export type TeamOnboardingUser = {
  email: string;
  fullName: string;
  teamId: string | null;
};

export async function loadTeamOnboardingUser(email: string): Promise<TeamOnboardingUser> {
  const user = await getUserByEmail(getDb(), email);

  if (!user?.fullName || !user.email) {
    throw new Error("User data is missing");
  }

  return {
    email: user.email,
    fullName: user.fullName,
    teamId: user.teamId ?? null,
  };
}

async function sendTeamOnboardingEmail(args: { to: string; subject: string; html: string }) {
  await sendEmail({
    to: args.to,
    subject: args.subject,
    from: getSupportFromDisplay(),
    replyTo: getSupportReplyToEmail(),
    html: args.html,
  });
}

export async function sendWelcomeEmailForOnboarding(user: TeamOnboardingUser) {
  await sendTeamOnboardingEmail({
    to: user.email,
    subject: "Welcome to Tamias",
    html: await render(
      WelcomeEmail({
        fullName: user.fullName,
      }),
    ),
  });
}

export async function sendTrialActivationEmailForOnboarding(user: TeamOnboardingUser) {
  await sendTeamOnboardingEmail({
    to: user.email,
    subject: "Connect your bank to see the full picture",
    html: await render(TrialActivationEmail({ fullName: user.fullName })),
  });
}

export async function sendTrialExpiringEmailForOnboarding(user: TeamOnboardingUser) {
  await sendTeamOnboardingEmail({
    to: user.email,
    subject: "Your bank sync and invoicing stop tomorrow",
    html: await render(
      TrialExpiringEmail({
        fullName: user.fullName,
      }),
    ),
  });
}

export async function sendTrialEndedEmailForOnboarding(user: TeamOnboardingUser) {
  await sendTeamOnboardingEmail({
    to: user.email,
    subject: "Your Tamias trial has ended",
    html: await render(TrialEndedEmail({ fullName: user.fullName })),
  });
}

export async function sendTrialDeactivatedEmailForOnboarding(user: TeamOnboardingUser) {
  await sendTeamOnboardingEmail({
    to: user.email,
    subject: "Your bank sync will be paused soon",
    html: await render(TrialDeactivatedEmail({ fullName: user.fullName })),
  });
}

export async function shouldSendTeamOnboardingEmail(teamId: string) {
  const team = await getTeamById(getDb(), teamId);

  if (!team) {
    throw new Error("Team not found");
  }

  return team.plan === "trial";
}

export async function hasBankConnectionsForOnboarding(teamId: string) {
  const bankConnections = await getBankConnections(getDb(), {
    teamId,
  });

  return bankConnections.length > 0;
}
