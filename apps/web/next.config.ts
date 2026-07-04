import type { NextConfig } from "next";
import { join } from "node:path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Emit a self-contained server bundle (.next/standalone) for the production
  // Docker image; see apps/web/Dockerfile.
  output: "standalone",
  turbopack: {
    root: join(__dirname),
  },
};

export default nextConfig;
