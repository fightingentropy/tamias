import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { getLocalEnvValue } from "./local-env";

const publicInvoiceByNumberRef = makeFunctionReference<
  "query",
  {
    serviceKey: string;
    invoiceNumber: string;
  },
  { token?: string | null } | null
>("publicInvoices:serviceGetPublicInvoiceByInvoiceNumber");

const listTeamsByUserIdRef = makeFunctionReference<
  "query",
  {
    serviceKey: string;
    email: string;
  },
  Array<{ id: string }>
>("identity:serviceListTeamsByUserId");

const switchCurrentTeamRef = makeFunctionReference<
  "mutation",
  {
    serviceKey: string;
    email: string;
    publicTeamId: string;
  },
  unknown
>("identity:serviceSwitchCurrentTeam");

const createTeamForUserIdRef = makeFunctionReference<
  "mutation",
  {
    serviceKey: string;
    email: string;
    publicTeamId: string | null;
    name: string;
    baseCurrency: string;
    countryCode: string;
    fiscalYearStartMonth: number;
    companyType: string;
    heardAbout: string;
    switchTeam: boolean;
  },
  string | null
>("identity:serviceCreateTeamForUserId");

const getUserByIdRef = makeFunctionReference<
  "query",
  {
    serviceKey: string;
    email: string;
  },
  {
    id?: string;
    convexId?: string;
    teamId?: string | null;
  } | null
>("identity:serviceGetUserById");

const updateUserByIdRef = makeFunctionReference<
  "mutation",
  {
    serviceKey: string;
    userId?: string;
    email: string;
    currentEmail: string;
    fullName: string;
  },
  unknown
>("identity:serviceUpdateUserById");

function getConvexUrl(): string {
  const convexUrl =
    getLocalEnvValue("CONVEX_URL") ?? getLocalEnvValue("TAMIAS_CONVEX_URL");

  if (!convexUrl) {
    throw new Error(
      "CONVEX_URL or TAMIAS_CONVEX_URL is required for Playwright smoke tests.",
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

  throw new Error("CONVEX_SERVICE_KEY is required for Playwright smoke tests.");
}

function createConvexClient(): ConvexHttpClient {
  return new ConvexHttpClient(getConvexUrl(), { logger: false });
}

export async function getInvoiceTokenByNumber(
  invoiceNumber: string,
): Promise<string> {
  const client = createConvexClient();
  const record = await client.query(publicInvoiceByNumberRef, {
    serviceKey: getConvexServiceKey(),
    invoiceNumber,
  });

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
  const teams = await client.query(listTeamsByUserIdRef, {
    serviceKey,
    email,
  });

  if (teams.some((team) => team.id === teamId)) {
    await client.mutation(switchCurrentTeamRef, {
      serviceKey,
      email,
      publicTeamId: teamId,
    });

    return;
  }

  await client.mutation(createTeamForUserIdRef, {
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
  const user = await client.query(getUserByIdRef, {
    serviceKey,
    email,
  });

  if (!user?.id) {
    throw new Error(`No user found for smoke-test email ${email}.`);
  }

  let teamId = user.teamId ?? null;

  if (!teamId) {
    teamId = await client.mutation(createTeamForUserIdRef, {
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
    throw new Error(
      `Failed to create or resolve a smoke-test team for ${email}.`,
    );
  }

  await client.mutation(updateUserByIdRef, {
    serviceKey,
    userId: user.convexId,
    email,
    currentEmail: email,
    fullName: "Playwright Smoke",
  });

  await ensureSmokeUserTeamInConvex(email, teamId);

  return teamId;
}
