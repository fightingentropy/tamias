export type RootBootstrapData = {
  auth: {
    token: string | null;
    refreshToken: string | null;
  };
  fetchedAt: number;
};

export const DEFAULT_ROOT_BOOTSTRAP: RootBootstrapData = {
  auth: {
    token: null,
    refreshToken: null,
  },
  fetchedAt: 0,
};
