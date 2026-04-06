import { LocalCache } from "./local-cache";

const userContextCache = new LocalCache<ChatUserContext>(30 * 60);
const teamContextCache = new LocalCache<ChatTeamContext>(5 * 60);

// Disable caching in development
const isDevelopment = process.env.NODE_ENV === "development";

export interface ChatTeamContext {
  teamId: string;
  hasBankAccounts?: boolean;
}

export interface ChatUserContext {
  userId: string;
  teamId: string;
  teamName?: string | null;
  fullName?: string | null;
  avatarUrl?: string | null;
  baseCurrency?: string | null;
  countryCode?: string | null;
  dateFormat?: string | null;
  locale?: string | null;
  country?: string | null;
  city?: string | null;
  region?: string | null;
  timezone?: string | null;
  fiscalYearStartMonth?: number | null;
  hasBankAccounts?: boolean;
}

export const chatCache = {
  getUserContext: (userId: string, teamId: string): Promise<ChatUserContext | undefined> => {
    if (isDevelopment) return Promise.resolve(undefined);
    return Promise.resolve(userContextCache.get(`${userId}:${teamId}`));
  },

  setUserContext: (userId: string, teamId: string, context: ChatUserContext): Promise<void> => {
    if (isDevelopment) return Promise.resolve();
    userContextCache.set(`${userId}:${teamId}`, context);
    return Promise.resolve();
  },

  invalidateUserContext: (userId: string, teamId: string): Promise<void> => {
    if (isDevelopment) return Promise.resolve();
    userContextCache.delete(`${userId}:${teamId}`);
    return Promise.resolve();
  },

  getTeamContext: (teamId: string): Promise<ChatTeamContext | undefined> => {
    if (isDevelopment) return Promise.resolve(undefined);
    return Promise.resolve(teamContextCache.get(teamId));
  },

  setTeamContext: (teamId: string, context: ChatTeamContext): Promise<void> => {
    if (isDevelopment) return Promise.resolve();
    teamContextCache.set(teamId, context);
    return Promise.resolve();
  },

  invalidateTeamContext: (teamId: string): Promise<void> => {
    if (isDevelopment) return Promise.resolve();
    teamContextCache.delete(teamId);
    return Promise.resolve();
  },
};
