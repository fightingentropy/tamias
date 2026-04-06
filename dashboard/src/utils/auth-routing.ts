export type AuthenticatedUserRedirectState = {
  fullName?: string | null;
  teamId?: string | null;
};

export function hasCompletedOnboarding(user: AuthenticatedUserRedirectState | null | undefined) {
  return Boolean(user?.fullName && user?.teamId);
}

export function getPostAuthRedirectPath(user: AuthenticatedUserRedirectState | null | undefined) {
  return hasCompletedOnboarding(user) ? "/dashboard" : "/onboarding";
}
