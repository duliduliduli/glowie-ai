import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: { remotePatterns: [{ protocol: "https", hostname: "*.blob.vercel-storage.com" }] },
  experimental: { serverActions: { bodySizeLimit: "12mb" } },
};

export default nextConfig;
