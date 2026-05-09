/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The web app must transpile our shared workspace package.
  transpilePackages: ["@icd-mapper/shared"],
  // Cloudflare Pages prefers edge-rendered pages by default.
  experimental: {
    serverActions: { allowedOrigins: ["*"] },
  },
  images: { unoptimized: true },
};

export default nextConfig;
