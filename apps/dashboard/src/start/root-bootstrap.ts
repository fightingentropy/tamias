export type RootBootstrapData = {
  auth: {
    token: string | null;
    refreshToken: string | null;
  };
  host: {
    appUrl: string;
    websiteUrl: string;
    appHost: string;
    websiteHost: string;
    currentHost: string;
    isAppHost: boolean;
    isWebsiteHost: boolean;
  };
  fetchedAt: number;
};

export const DEFAULT_ROOT_BOOTSTRAP: RootBootstrapData = {
  auth: {
    token: null,
    refreshToken: null,
  },
  host: {
    appUrl: "",
    websiteUrl: "",
    appHost: "",
    websiteHost: "",
    currentHost: "",
    isAppHost: true,
    isWebsiteHost: false,
  },
  fetchedAt: 0,
};
