import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Aumentar límite de body para subida de PDFs grandes (hasta 25MB)
  experimental: {
    serverActions: {
      bodySizeLimit: '25mb',
    },
  },
};

export default nextConfig;
