import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname, ".."),

  // Performance optimizations
  experimental: {
    scrollRestoration: true,
  },

  // Image optimization
  images: {
    formats: ["image/webp", "image/avif"],
    minimumCacheTTL: 60,
  },

  // Compression
  compress: true,

  // Bundle analysis
  webpack: (config, { dev }) => {
    if (!dev) {
      // Enable webpack bundle analyzer in production
      // You can uncomment this to analyze bundle size
      // config.plugins.push(new BundleAnalyzerPlugin());
    }
    return config;
  },
};

export default nextConfig;
