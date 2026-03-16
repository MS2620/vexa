import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    domains: ["image.tmdb.org"],
  },
};

export default nextConfig;
