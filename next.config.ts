import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['pdfjs-dist', '@react-pdf/renderer'],
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
