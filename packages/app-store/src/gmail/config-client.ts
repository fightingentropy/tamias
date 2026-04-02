import { baseConfig } from "./config-base";
import gmailImage from "./assets/gmail.jpg";

// Client-side config with images for dashboard/browser surfaces.
export default {
  ...baseConfig,
  images: [gmailImage.src],
};
