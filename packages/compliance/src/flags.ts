export function isUkComplianceVisible(params?: {
  countryCode?: string | null;
  profileEnabled?: boolean | null;
}): boolean {
  if (params?.profileEnabled) {
    return true;
  }

  return params?.countryCode?.toUpperCase() === "GB";
}
