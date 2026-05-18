type PolarClient = InstanceType<typeof import("@polar-sh/sdk").Polar>;

let polarApiPromise: Promise<PolarClient> | undefined;

export function getPolarApi() {
  polarApiPromise ??= import("@polar-sh/sdk").then(({ Polar }) => {
    return new Polar({
      accessToken: process.env.POLAR_ACCESS_TOKEN!,
      server: process.env.POLAR_ENVIRONMENT as "production" | "sandbox",
    });
  });

  return polarApiPromise;
}
