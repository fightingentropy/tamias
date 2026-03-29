import { ConvexHttpClient } from "convex/browser";
import { api } from "@tamias/convex-model/api";
import { getLocalEnvValue } from "./local-env";

function getConvexUrl(): string {
  const convexUrl =
    getLocalEnvValue("CONVEX_URL") ??
    getLocalEnvValue("NEXT_PUBLIC_CONVEX_URL");

  if (!convexUrl) {
    throw new Error(
      "CONVEX_URL or NEXT_PUBLIC_CONVEX_URL is required for Playwright smoke tests.",
    );
  }

  return convexUrl;
}

function getConvexServiceKey(): string {
  const serviceKey = getLocalEnvValue("CONVEX_SERVICE_KEY");

  if (serviceKey) {
    return serviceKey;
  }

  const convexUrl = getConvexUrl();

  if (convexUrl.includes("127.0.0.1") || convexUrl.includes("localhost")) {
    return "local-dev";
  }

  throw new Error(
    "CONVEX_SERVICE_KEY is required for Playwright smoke tests.",
  );
}

function createConvexClient(): ConvexHttpClient {
  return new ConvexHttpClient(getConvexUrl(), { logger: false });
}

export async function getInvoiceTokenByNumber(
  invoiceNumber: string,
): Promise<string> {
  const client = createConvexClient();
  const record = await client.query(
    api.publicInvoices.serviceGetPublicInvoiceByInvoiceNumber,
    {
      serviceKey: getConvexServiceKey(),
      invoiceNumber,
    },
  );

  if (!record?.token) {
    throw new Error(
      `No invoice token found for invoice number ${invoiceNumber}.`,
    );
  }

  return record.token;
}

async function ensureSmokeUserTeamInConvex(email: string, teamId: string) {
  const client = createConvexClient();
  const serviceKey = getConvexServiceKey();
  const teams = await client.query(api.identity.serviceListTeamsByUserId, {
    serviceKey,
    email,
  });

  if (teams.some((team) => team.id === teamId)) {
    await client.mutation(api.identity.serviceSwitchCurrentTeam, {
      serviceKey,
      email,
      publicTeamId: teamId,
    });

    return;
  }

  await client.mutation(api.identity.serviceCreateTeamForUserId, {
    serviceKey,
    email,
    publicTeamId: teamId,
    name: "Playwright Ltd",
    baseCurrency: "GBP",
    countryCode: "GB",
    fiscalYearStartMonth: 1,
    companyType: "exploring",
    heardAbout: "github",
    switchTeam: true,
  });
}

export async function ensureSmokeUserProfile(email: string): Promise<string> {
  const client = createConvexClient();
  const serviceKey = getConvexServiceKey();
  const user = await client.query(api.identity.serviceGetUserById, {
    serviceKey,
    email,
  });

  if (!user?.id) {
    throw new Error(`No user found for smoke-test email ${email}.`);
  }

  let teamId = user.teamId ?? null;

  if (!teamId) {
    teamId = await client.mutation(api.identity.serviceCreateTeamForUserId, {
      serviceKey,
      email,
      publicTeamId: null,
      name: "Playwright Ltd",
      baseCurrency: "GBP",
      countryCode: "GB",
      fiscalYearStartMonth: 1,
      companyType: "exploring",
      heardAbout: "github",
      switchTeam: true,
    });
  }

  if (!teamId) {
    throw new Error(`Failed to create or resolve a smoke-test team for ${email}.`);
  }

  await client.mutation(api.identity.serviceUpdateUserById, {
    serviceKey,
    userId: user.convexId,
    email,
    currentEmail: email,
    fullName: "Playwright Smoke",
  });

  await ensureSmokeUserTeamInConvex(email, teamId);

  return teamId;
}
