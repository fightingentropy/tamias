import { Resend } from "resend";

const getMissingResendError = () =>
  new Error("Missing RESEND_API_KEY. Email features are unavailable.");

let cachedClient: Resend | null | undefined;

const getResendClient = () => {
  if (cachedClient === undefined) {
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
      cachedClient = null;
      return null;
    }

    cachedClient = new Resend(apiKey);
  }

  return cachedClient;
};

export const resend = new Proxy({} as Resend, {
  get(target, prop, receiver) {
    const client = getResendClient();

    if (!client) {
      throw getMissingResendError();
    }

    return Reflect.get(client, prop, receiver);
  },
});
