import { z } from "zod";

const schema = {
  PLAID_CLIENT_ID: z.string().min(1),
  PLAID_SECRET: z.string().min(1),
  PLAID_ENVIRONMENT: z.string().default("sandbox"),
  R2_ENDPOINT: z.string().url(),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET_NAME: z.string().min(1),
  LOGO_DEV_TOKEN: z.string().min(1),
} as const;

type BankingEnv = {
  [K in keyof typeof schema]: z.infer<(typeof schema)[K]>;
};

const cache = new Map<keyof BankingEnv, BankingEnv[keyof BankingEnv]>();

function getEnvValue<K extends keyof BankingEnv>(key: K): BankingEnv[K] {
  if (cache.has(key)) {
    return cache.get(key) as BankingEnv[K];
  }

  const result = schema[key].safeParse(process.env[key]);

  if (!result.success) {
    const issue = result.error.issues[0];
    const detail = issue?.message ? `: ${issue.message}` : "";

    throw new Error(`Invalid banking environment variable ${key}${detail}`);
  }

  cache.set(key, result.data);

  return result.data;
}

// Validate provider config lazily so local API startup doesn't require every
// banking integration secret up front.
export const env = new Proxy({} as BankingEnv, {
  get(_target, property) {
    if (typeof property !== "string" || !(property in schema)) {
      return undefined;
    }

    return getEnvValue(property as keyof BankingEnv);
  },
});
