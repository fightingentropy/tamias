import { useEffect } from "react";
import type { TrackProperties } from "@openpanel/web";

const isProd = process.env.NODE_ENV === "production";
type AnalyticsClient = {
  track: (event: string, properties: TrackProperties) => Promise<unknown>;
};

let analyticsClient: AnalyticsClient | null | undefined;
let analyticsClientPromise: Promise<AnalyticsClient | null> | undefined;

async function createAnalyticsClient() {
  if (typeof window === "undefined" || !process.env.OPENPANEL_CLIENT_ID) {
    return null;
  }

  const { OpenPanel } = await import("@openpanel/web");

  const client = new OpenPanel({
    clientId: process.env.OPENPANEL_CLIENT_ID,
    trackAttributes: true,
    trackScreenViews: isProd,
    trackOutgoingLinks: isProd,
  });
  analyticsClient = client;

  return analyticsClient;
}

function getAnalyticsClient() {
  if (analyticsClient !== undefined) {
    return Promise.resolve(analyticsClient);
  }

  analyticsClientPromise ??= createAnalyticsClient().then((client) => {
    analyticsClient = client;
    return client;
  });

  return analyticsClientPromise;
}

const Provider = () => {
  useEffect(() => {
    const loadAnalytics = () => {
      void getAnalyticsClient();
    };

    if ("requestIdleCallback" in window) {
      const idleId = window.requestIdleCallback(loadAnalytics);

      return () => {
        window.cancelIdleCallback(idleId);
      };
    }

    const timeoutId = globalThis.setTimeout(loadAnalytics, 1);

    return () => {
      globalThis.clearTimeout(timeoutId);
    };
  }, []);

  return null;
};

const track = (options: { event: string } & TrackProperties) => {
  if (!isProd) {
    console.log("Track", options);
    return;
  }

  const { event, ...rest } = options;

  void getAnalyticsClient().then((client) => {
    if (!client) {
      return;
    }

    void client.track(event, rest);
  });
};

export { Provider, track };
