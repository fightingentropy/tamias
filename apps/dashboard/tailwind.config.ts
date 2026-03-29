import baseConfig from "@tamias/ui/tailwind.config";
import type { Config } from "tailwindcss";

const sharedPreset = baseConfig as unknown as Partial<Config>;

export default {
  content: [
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
    "../../packages/invoice/src/**/*.{ts,tsx}",
  ],
  presets: [sharedPreset],
} satisfies Config;
