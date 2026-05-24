import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// Makes Cloudflare bindings (D1/KV/R2) available during `next dev`. No-op in
// production builds.
initOpenNextCloudflareForDev();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The web app must transpile our shared workspace package.
  transpilePackages: ["@icd-mapper/shared"],
  images: { unoptimized: true },
  // ESLint 9 / eslint-config-next peer mismatch shouldn't block deploys.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
