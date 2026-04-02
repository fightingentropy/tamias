import { useEffect } from "react";
import { OpenPanel, type TrackProperties } from "@openpanel/web";

const isProd = process.env.NODE_ENV === "production";
let analyticsClient: OpenPanel | null | undefined;

function getAnalyticsClient() {
  if (analyticsClient !== undefined) {
    return analyticsClient;
  }

  if (
    typeof window === "undefined" ||
    !process.env.OPENPANEL_CLIENT_ID
  ) {
    analyticsClient = null;
    return analyticsClient;
  }

  analyticsClient = new OpenPanel({
    clientId: process.env.OPENPANEL_CLIENT_ID,
    trackAttributes: true,
    trackScreenViews: isProd,
    trackOutgoingLinks: isProd,
  });
  analyticsClient.init();

  return analyticsClient;
}

const Provider = () => {
  useEffect(() => {
    getAnalyticsClient();
  }, []);

  return null;
};

const track = (options: { event: string } & TrackProperties) => {
  const client = getAnalyticsClient();

  if (!isProd) {
    console.log("Track", options);
    return;
  }

  if (!client) {
    return;
  }

  const { event, ...rest } = options;

  void client.track(event, rest);
};

export { Provider, track };
