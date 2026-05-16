export type PasswordAuthMode = "signIn" | "signUp";

const INVALID_CREDENTIALS_PATTERN = /InvalidAccountId|InvalidSecret/i;
const RATE_LIMIT_PATTERN = /TooManyFailedAttempts/i;
const ACCOUNT_EXISTS_PATTERN = /Account .* already exists/i;
const INVALID_PASSWORD_PATTERN = /Invalid password/i;
const NETWORK_ERROR_PATTERN =
  /fetch failed|Failed to fetch|NetworkError|ECONNREFUSED|connection refused|Load failed|networkerror|not connected|ECONNRESET/i;

export function getPasswordAuthErrorMessage(authError: unknown, mode: PasswordAuthMode): string {
  const fallbackMessage =
    mode === "signIn" ? "Unable to sign in." : "Unable to create your account.";

  if (!(authError instanceof Error)) {
    return fallbackMessage;
  }

  const { message } = authError;

  if (INVALID_CREDENTIALS_PATTERN.test(message)) {
    return "Incorrect email or password.";
  }

  if (RATE_LIMIT_PATTERN.test(message)) {
    return "Too many failed attempts. Try again in a minute.";
  }

  if (ACCOUNT_EXISTS_PATTERN.test(message)) {
    return "An account with this email already exists. Sign in instead.";
  }

  if (INVALID_PASSWORD_PATTERN.test(message)) {
    return "Password must be at least 8 characters.";
  }

  if (NETWORK_ERROR_PATTERN.test(message)) {
    return "Could not reach the authentication service. Run the full stack with `bun run dev` from the repo root and confirm the API worker is available.";
  }

  return fallbackMessage;
}
