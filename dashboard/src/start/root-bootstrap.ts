export type RootBootstrapData = {
  auth: {
    token: string | null;
    hasRefreshToken: boolean;
  };
  fetchedAt: number;
};

export const DEFAULT_ROOT_BOOTSTRAP: RootBootstrapData = {
  auth: {
    token: null,
    hasRefreshToken: false,
  },
  fetchedAt: 0,
};
