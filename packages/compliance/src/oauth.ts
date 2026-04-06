import { decryptOAuthState, encryptOAuthState } from "@tamias/encryption";
import type { GenericId } from "convex/values";
import { type AuthorityProviderId, AuthorityProviderIdSchema } from "./types";

export interface ComplianceOAuthStatePayload {
  teamId: string;
  convexUserId: GenericId<"appUsers">;
  provider: AuthorityProviderId;
  source: "apps" | "settings";
}

function isValidComplianceOAuthState(parsed: unknown): parsed is ComplianceOAuthStatePayload {
  if (typeof parsed !== "object" || parsed === null) {
    return false;
  }

  const record = parsed as Record<string, unknown>;

  return (
    typeof record.teamId === "string" &&
    typeof record.convexUserId === "string" &&
    AuthorityProviderIdSchema.safeParse(record.provider).success &&
    ["apps", "settings"].includes(record.source as string)
  );
}

export function encryptComplianceOAuthState(payload: ComplianceOAuthStatePayload): string {
  return encryptOAuthState(payload);
}

export function decryptComplianceOAuthState(
  encryptedState: string,
): ComplianceOAuthStatePayload | null {
  return decryptOAuthState(encryptedState, isValidComplianceOAuthState);
}
