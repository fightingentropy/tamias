import { hash } from "@tamias/encryption";
import { safeCompare } from "./safe-compare";

export type OAuthApplication = {
  id: string;
  active: boolean | null;
  clientSecret: string;
};

export function validateClientCredentials(
  application: OAuthApplication | null | undefined,
  clientSecret: string,
): boolean {
  if (!application || !application.active) {
    return false;
  }

  const hashedSecret = hash(clientSecret);
  const storedSecret = application.clientSecret;

  // Use timing-safe comparison to prevent timing attacks
  return safeCompare(storedSecret, hashedSecret);
}
