import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Leaflet CSS/이미지 처리를 위해 transpile 불필요. react-leaflet은 클라이언트에서만 사용.
  experimental: {
    optimizePackageImports: ["recharts", "leaflet", "react-leaflet"],
  },
};

export default nextConfig;
