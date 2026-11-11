import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle, only for the Docker image (portal/Dockerfile sets NEXT_OUTPUT).
  // `next start` (local / Codespaces) uses the regular build output.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  cacheComponents: true,
  partialPrefetching: true,
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
