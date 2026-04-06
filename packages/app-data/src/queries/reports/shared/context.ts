import type { Database } from "../../../client";
import { createQueryCacheKey, getOrSetQueryCacheValue } from "../../../client";
import { getTeamById } from "../../teams";
import { getCogsCategorySlugsFromStaticTaxonomy } from "./category-taxonomy";

const CACHE_TTL = 5 * 60 * 1000;

const teamCurrencyCache = new Map<string, { currency: string | null; timestamp: number }>();
const cogsSlugsCache = new Map<string, { slugs: string[]; timestamp: number }>();

export type TeamReportContext = {
  currency: string | null;
  baseCurrency: string | null;
  countryCode: string | null;
};

export async function getTeamReportContext(
  db: Database,
  teamId: string,
  inputCurrency?: string,
): Promise<TeamReportContext> {
  return getOrSetQueryCacheValue(
    db,
    createQueryCacheKey("reports:team-context", {
      teamId,
      inputCurrency: inputCurrency ?? null,
    }),
    async () => {
      const team = await getTeamById(db, teamId);

      const cached = teamCurrencyCache.get(teamId);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return {
          currency: inputCurrency ?? cached.currency,
          baseCurrency: cached.currency,
          countryCode: team?.countryCode ?? null,
        };
      }

      const currency = team?.baseCurrency ?? null;
      teamCurrencyCache.set(teamId, { currency, timestamp: Date.now() });

      return {
        currency: inputCurrency ?? currency,
        baseCurrency: currency,
        countryCode: team?.countryCode ?? null,
      };
    },
  );
}

export async function getCogsCategorySlugs(_db: Database, teamId: string): Promise<string[]> {
  const cached = cogsSlugsCache.get(teamId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.slugs;
  }

  const slugs = getCogsCategorySlugsFromStaticTaxonomy();

  cogsSlugsCache.set(teamId, { slugs, timestamp: Date.now() });
  return slugs;
}

export async function getTargetCurrency(
  db: Database,
  teamId: string,
  inputCurrency?: string,
): Promise<string | null> {
  const context = await getTeamReportContext(db, teamId, inputCurrency);
  return context.currency;
}
