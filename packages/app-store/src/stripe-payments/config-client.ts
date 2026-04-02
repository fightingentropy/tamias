import { baseConfig } from "./config-base";
import stripeImage from "./assets/stripe.jpg";

// Client-side config with images for dashboard/browser surfaces.
export default {
  ...baseConfig,
  images: [stripeImage.src],
};
