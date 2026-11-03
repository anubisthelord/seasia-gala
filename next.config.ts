import type { NextConfig } from "next";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  basePath,
  async redirects() {
    if (!basePath) return [];

    return [
      {
        // basePath: false matches the bare domain root ("/"), outside the basePath
        source: "/",
        destination: basePath,
        basePath: false,
        permanent: false,
      },
    ];
  },
  turbopack: {
    root: process.cwd(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
