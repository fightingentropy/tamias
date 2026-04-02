import { baseConfig } from "./config-base";
import xeroImage from "./assets/xero.jpg";

// Client-side config with images for dashboard/browser surfaces.
export default {
  ...baseConfig,
  images: [xeroImage.src],
};
