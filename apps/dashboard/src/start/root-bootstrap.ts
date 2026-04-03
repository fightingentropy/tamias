export type RootBootstrapData = {
  auth: {
    token: string | null;
    refreshToken: string | null;
  };
  host: {
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
    appHost: "",
    websiteHost: "",
    currentHost: "",
    isAppHost: true,
    isWebsiteHost: false,
  },
  fetchedAt: 0,
};
