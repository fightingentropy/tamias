"use client";

import { Route as RootRoute } from "@/start/routes/__root";

type SiteLoginUrlHostContext = {
  appUrl: string;
  websiteUrl: string;
};

export function buildSiteLoginUrl(host: SiteLoginUrlHostContext) {
  if (!host.appUrl || !host.websiteUrl || host.appUrl === host.websiteUrl) {
    return "/login";
  }

  return new URL("/login", host.appUrl).toString();
}

export function useSiteLoginUrl() {
  const bootstrap = RootRoute.useLoaderData();

  return buildSiteLoginUrl(bootstrap.host);
}
