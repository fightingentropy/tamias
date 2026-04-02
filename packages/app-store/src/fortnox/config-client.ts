import { baseConfig } from "./config-base";
import fortnoxImage from "./assets/fortnox.jpg";

// Client-side config with images for dashboard/browser surfaces.
export default {
  ...baseConfig,
  images: [fortnoxImage.src],
};
