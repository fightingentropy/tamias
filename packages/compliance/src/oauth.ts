import { decryptOAuthState, encryptOAuthState } from "@tamias/encryption";
import { type AuthorityProviderId, AuthorityProviderIdSchema } from "./types";

export interface ComplianceOAuthStatePayload {
  teamId: string;
  userId: string;
  provider: AuthorityProviderId;
  source: "apps" | "settings";
  issuedAt: number;
  expiresAt: number;
}

function isValidComplianceOAuthState(parsed: unknown): parsed is ComplianceOAuthStatePayload {
  if (typeof parsed !== "object" || parsed === null) {
    return false;
  }

  const record = parsed as Record<string, unknown>;

  return (
    typeof record.issuedAt === "number" &&
    record.issuedAt <= Date.now() &&
    typeof record.expiresAt === "number" &&
    record.expiresAt > Date.now() &&
    record.expiresAt - record.issuedAt <= 10 * 60 * 1000 &&
    typeof record.teamId === "string" &&
    typeof record.userId === "string" &&
    AuthorityProviderIdSchema.safeParse(record.provider).success &&
    ["apps", "settings"].includes(record.source as string)
  );
}

export function encryptComplianceOAuthState(
  payload: Omit<ComplianceOAuthStatePayload, "issuedAt" | "expiresAt">,
): string {
  const issuedAt = Date.now();
  return encryptOAuthState({ ...payload, issuedAt, expiresAt: issuedAt + 10 * 60 * 1000 });
}

export function decryptComplianceOAuthState(
  encryptedState: string,
): ComplianceOAuthStatePayload | null {
  return decryptOAuthState(encryptedState, isValidComplianceOAuthState);
}
