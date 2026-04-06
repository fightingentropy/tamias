import { PlainClient } from "@team-plain/typescript-sdk";

const getMissingPlainError = () =>
  new Error("Missing PLAIN_API_KEY. Support features are unavailable.");

let cachedClient: PlainClient | null | undefined;

const getPlainClient = () => {
  if (cachedClient === undefined) {
    const apiKey = process.env.PLAIN_API_KEY;

    if (!apiKey) {
      cachedClient = null;
      return null;
    }

    cachedClient = new PlainClient({ apiKey });
  }

  return cachedClient;
};

export const plain = new Proxy({} as PlainClient, {
  get(target, prop, receiver) {
    const client = getPlainClient();

    if (!client) {
      throw getMissingPlainError();
    }

    return Reflect.get(client, prop, receiver);
  },
});
