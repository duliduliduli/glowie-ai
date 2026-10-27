import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Above our own 10 MB photo limit, so oversize photos get the friendly message instead of a truncated body.
  experimental: { proxyClientMaxBodySize: "12mb" },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
