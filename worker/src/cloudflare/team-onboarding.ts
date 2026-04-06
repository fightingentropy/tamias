import { getBankConnections, getTeamById, getUserByEmail } from "@tamias/app-data/queries";
import { TrialActivationEmail } from "@tamias/email/emails/trial-activation";
import { TrialDeactivatedEmail } from "@tamias/email/emails/trial-deactivated";
import { TrialEndedEmail } from "@tamias/email/emails/trial-ended";
import { TrialExpiringEmail } from "@tamias/email/emails/trial-expiring";
import { WelcomeEmail } from "@tamias/email/emails/welcome";
import { render } from "@tamias/email/render";
import { getSupportFromDisplay, getSupportReplyToEmail } from "@tamias/utils/envs";
import { Resend } from "resend";
import { getDb } from "../utils/db";

type TeamOnboardingEnv = {
  RESEND_API_KEY?: string;
  RESEND_AUDIENCE_ID?: string;
};

export type TeamOnboardingUser = {
  email: string;
  fullName: string;
  teamId: string | null;
};

function getResendClient(env?: TeamOnboardingEnv) {
  const apiKey = env?.RESEND_API_KEY || process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error("Missing RESEND_API_KEY");
  }

  return new Resend(apiKey);
}

function getResendAudienceId(env?: TeamOnboardingEnv) {
  const audienceId = env?.RESEND_AUDIENCE_ID || process.env.RESEND_AUDIENCE_ID;

  if (!audienceId) {
    throw new Error("Missing RESEND_AUDIENCE_ID");
  }

  return audienceId;
}

function getContactNameParts(fullName: string) {
  const [firstName, ...rest] = fullName.split(" ");

  return {
    firstName: firstName || undefined,
    lastName: rest.join(" ") || undefined,
  };
}

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

export async function createTeamOnboardingContact(
  user: TeamOnboardingUser,
  env?: TeamOnboardingEnv,
) {
  const resend = getResendClient(env);
  const audienceId = getResendAudienceId(env);
  const { firstName, lastName } = getContactNameParts(user.fullName);

  await resend.contacts.create({
    email: user.email,
    firstName,
    lastName,
    unsubscribed: false,
    audienceId,
  });
}

async function sendTeamOnboardingEmail(args: {
  env?: TeamOnboardingEnv;
  to: string;
  subject: string;
  html: string;
}) {
  const resend = getResendClient(args.env);

  await resend.emails.send({
    to: args.to,
    subject: args.subject,
    from: getSupportFromDisplay(),
    replyTo: getSupportReplyToEmail(),
    html: args.html,
  });
}

export async function sendWelcomeEmailForOnboarding(
  user: TeamOnboardingUser,
  env?: TeamOnboardingEnv,
) {
  await sendTeamOnboardingEmail({
    env,
    to: user.email,
    subject: "Welcome to Tamias",
    html: await render(
      WelcomeEmail({
        fullName: user.fullName,
      }),
    ),
  });
}

export async function sendTrialActivationEmailForOnboarding(
  user: TeamOnboardingUser,
  env?: TeamOnboardingEnv,
) {
  await sendTeamOnboardingEmail({
    env,
    to: user.email,
    subject: "Connect your bank to see the full picture",
    html: await render(TrialActivationEmail({ fullName: user.fullName })),
  });
}

export async function sendTrialExpiringEmailForOnboarding(
  user: TeamOnboardingUser,
  env?: TeamOnboardingEnv,
) {
  await sendTeamOnboardingEmail({
    env,
    to: user.email,
    subject: "Your bank sync and invoicing stop tomorrow",
    html: await render(
      TrialExpiringEmail({
        fullName: user.fullName,
      }),
    ),
  });
}

export async function sendTrialEndedEmailForOnboarding(
  user: TeamOnboardingUser,
  env?: TeamOnboardingEnv,
) {
  await sendTeamOnboardingEmail({
    env,
    to: user.email,
    subject: "Your Tamias trial has ended",
    html: await render(TrialEndedEmail({ fullName: user.fullName })),
  });
}

export async function sendTrialDeactivatedEmailForOnboarding(
  user: TeamOnboardingUser,
  env?: TeamOnboardingEnv,
) {
  await sendTeamOnboardingEmail({
    env,
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
