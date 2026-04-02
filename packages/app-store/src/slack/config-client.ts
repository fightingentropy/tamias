import { baseConfig } from "./config-base";
import slackImage from "./assets/slack.jpg";
import { onInitialize } from "./initialize";

// Client-side config with images for dashboard/browser surfaces.
export default {
  ...baseConfig,
  onInitialize,
  images: [slackImage.src],
};
