export type TeamRole = "owner" | "member";
export const AI_PROVIDER_VALUES = ["openai", "kimi", "openrouter"] as const;
export type AIProvider = (typeof AI_PROVIDER_VALUES)[number];
export const DEFAULT_AI_PROVIDER: AIProvider = "openai";

export type IdentitySnapshotUser = {
  userId: string;
  email: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  currentTeamId: string | null;
  locale: string | null;
  weekStartsOnMonday: boolean | null;
  timezone: string | null;
  timezoneAutoSync: boolean | null;
  timeFormat: number | null;
  dateFormat: string | null;
  aiProvider: AIProvider | null;
};

export type IdentitySnapshotTeam = {
  publicTeamId: string;
  name: string | null;
  logoUrl: string | null;
  inboxId: string | null;
  email: string | null;
  baseCurrency: string | null;
  countryCode: string | null;
  fiscalYearStartMonth: number | null;
  createdAt: string;
  canceledAt: string | null;
  plan: string | null;
  subscriptionStatus: string | null;
  stripeAccountId: string | null;
  stripeConnectStatus: string | null;
  companyType: string | null;
  heardAbout: string | null;
};

export type IdentitySnapshotMembership = {
  userId: string;
  publicTeamId: string;
  role: TeamRole | null;
  createdAt: string | null;
};

export const DEFAULT_USER_PREFERENCES = {
  locale: "en",
  weekStartsOnMonday: false,
  timezone: null,
  timezoneAutoSync: true,
  timeFormat: 24,
  dateFormat: null,
  aiProvider: DEFAULT_AI_PROVIDER,
} as const;

const INBOX_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

export function normalizeOptionalString(value: string | null | undefined) {
  const trimmed = value?.trim();

  return trimmed ? trimmed : null;
}

export function normalizeEmail(value: string | null | undefined) {
  const trimmed = value?.trim().toLowerCase();

  return trimmed ? trimmed : null;
}

export function nowIso() {
  return new Date().toISOString();
}

export function generateInboxId(length = 10) {
  let value = "";

  for (let index = 0; index < length; index += 1) {
    value += INBOX_ALPHABET[Math.floor(Math.random() * INBOX_ALPHABET.length)];
  }

  return value;
}

export function buildAppUserDefaults(input: {
  email?: string | null;
  fullName?: string | null;
  avatarUrl?: string | null;
}) {
  return {
    email: normalizeEmail(input.email) ?? undefined,
    fullName: normalizeOptionalString(input.fullName) ?? undefined,
    avatarUrl: normalizeOptionalString(input.avatarUrl) ?? undefined,
    locale: DEFAULT_USER_PREFERENCES.locale,
    weekStartsOnMonday: DEFAULT_USER_PREFERENCES.weekStartsOnMonday,
    timezone: DEFAULT_USER_PREFERENCES.timezone ?? undefined,
    timezoneAutoSync: DEFAULT_USER_PREFERENCES.timezoneAutoSync,
    timeFormat: DEFAULT_USER_PREFERENCES.timeFormat,
    dateFormat: DEFAULT_USER_PREFERENCES.dateFormat ?? undefined,
    aiProvider: DEFAULT_USER_PREFERENCES.aiProvider,
  };
}

export function buildTeamDefaults(input: {
  name?: string | null;
  logoUrl?: string | null;
  inboxId?: string | null;
  email?: string | null;
  baseCurrency?: string | null;
  countryCode?: string | null;
  fiscalYearStartMonth?: number | null;
  createdAt?: string | null;
  canceledAt?: string | null;
  plan?: string | null;
  subscriptionStatus?: string | null;
  stripeAccountId?: string | null;
  stripeConnectStatus?: string | null;
  companyType?: string | null;
  heardAbout?: string | null;
}) {
  return {
    name: normalizeOptionalString(input.name) ?? undefined,
    logoUrl: normalizeOptionalString(input.logoUrl) ?? undefined,
    inboxId: normalizeOptionalString(input.inboxId) ?? generateInboxId(),
    email: normalizeEmail(input.email) ?? undefined,
    baseCurrency: normalizeOptionalString(input.baseCurrency) ?? undefined,
    countryCode: normalizeOptionalString(input.countryCode) ?? undefined,
    fiscalYearStartMonth: input.fiscalYearStartMonth ?? undefined,
    createdAt: input.createdAt ?? nowIso(),
    canceledAt: normalizeOptionalString(input.canceledAt) ?? undefined,
    plan: normalizeOptionalString(input.plan) ?? "trial",
    subscriptionStatus: normalizeOptionalString(input.subscriptionStatus) ?? undefined,
    stripeAccountId: normalizeOptionalString(input.stripeAccountId) ?? undefined,
    stripeConnectStatus: normalizeOptionalString(input.stripeConnectStatus) ?? undefined,
    companyType: normalizeOptionalString(input.companyType) ?? undefined,
    heardAbout: normalizeOptionalString(input.heardAbout) ?? undefined,
  };
}
