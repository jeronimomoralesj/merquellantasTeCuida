import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['pdfjs-dist'],
  outputFileTracingIncludes: {
    '/api/certificados/**': ['./data/templates/**'],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '55mb',
    },
  },
};

export default nextConfig;
