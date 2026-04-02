import { baseConfig } from "./config-base";
import outlookImage from "./assets/outlook.jpg";

// Client-side config with images for dashboard/browser surfaces.
export default {
  ...baseConfig,
  images: [outlookImage.src],
};
