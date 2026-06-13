import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/app",
  async rewrites() {
    return [
      { source: "/", destination: "/landing-page.html", basePath: false },
    ];
  },
};

export default nextConfig;
