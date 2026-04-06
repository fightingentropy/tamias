import type { TrackProperties } from "@openpanel/sdk";

type ServerAnalyticsClient = {
  track: (event: string, properties: TrackProperties) => Promise<unknown>;
};

let analyticsClientPromise: Promise<ServerAnalyticsClient | null> | undefined;

async function getAnalyticsClient() {
  if (
    process.env.NODE_ENV !== "production" ||
    !process.env.OPENPANEL_CLIENT_ID ||
    !process.env.OPENPANEL_SECRET_KEY
  ) {
    return null;
  }

  analyticsClientPromise ??= import("@openpanel/sdk").then(({ OpenPanel }) => {
    return new OpenPanel({
      clientId: process.env.OPENPANEL_CLIENT_ID!,
      clientSecret: process.env.OPENPANEL_SECRET_KEY!,
    });
  });

  return analyticsClientPromise;
}

export const setupAnalytics = async () => {
  return {
    track: (options: { event: string } & TrackProperties) => {
      if (process.env.NODE_ENV !== "production") {
        console.log("Track", options);
        return;
      }

      const { event, ...rest } = options;

      void getAnalyticsClient().then((client) => {
        if (!client) {
          return;
        }

        void client.track(event, rest).catch(() => {});
      });
    },
  };
};
