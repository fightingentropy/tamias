/** @type {import("next").NextConfig} */
const config = {
  poweredByHeader: false,
  output: "standalone",
  reactStrictMode: true,
  trailingSlash: true,
  transpilePackages: [
    "@tamias/ui",
    "@tamias/tailwind",
    "@tamias/app-store",
    "next-mdx-remote",
  ],
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    inlineCss: true,
    optimizePackageImports: [
      "react-icons",
      "motion",
      "@tamias/ui",
      "@radix-ui/react-icons",
      "lucide-react",
      "framer-motion",
    ],
  },
  compiler: {
    removeConsole: {
      exclude: ["error", "warn"],
    },
  },
  images: {
    loader: "custom",
    loaderFile: "./image-loader.ts",
    // Limit max image size to 1200px (displayed size is ~1248px)
    // Default: [640, 750, 828, 1080, 1200, 1920, 2048, 3840]
    deviceSizes: [640, 750, 828, 1080, 1200],
    qualities: [50, 80],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  async redirects() {
    return [
      {
        source: "/en/(.*)",
        destination: "/",
        permanent: true,
      },
    ];
  },
};

export default config;
