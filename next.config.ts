import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Reference images upload via Uploadthing, not server actions, so keep
      // the server-action body limit tight to reduce POST body DoS surface.
      bodySizeLimit: "1mb",
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.ufs.sh" },
      { protocol: "https", hostname: "utfs.io" },
      { protocol: "https", hostname: "uploadthing.com" },
      { protocol: "https", hostname: "**.uploadthing.com" },
      { protocol: "https", hostname: "img.clerk.com" },
      { protocol: "https", hostname: "image.pollinations.ai" },
      { protocol: "https", hostname: "**.pollinations.ai" },
    ],
  },
};

export default nextConfig;
