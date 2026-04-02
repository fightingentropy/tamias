import { baseConfig } from "./config-base";
import whatsappImage from "./assets/whatsapp.jpg";
import { onInitialize } from "./initialize";

// Client-side config with images for dashboard/browser surfaces.
export default {
  ...baseConfig,
  onInitialize,
  images: [whatsappImage.src],
};
