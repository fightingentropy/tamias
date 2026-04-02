import { baseConfig } from "./config-base";
import quickBooksImage from "./assets/quickbooks.jpg";

// Client-side config with images for dashboard/browser surfaces.
export default {
  ...baseConfig,
  images: [quickBooksImage.src],
};
