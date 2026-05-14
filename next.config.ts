import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Webflow CDN — for images pulled from the CMS
      { protocol: "https", hostname: "**.webflow.com" },
      { protocol: "https", hostname: "**.webflowcdn.com" },
      // Google Docs / Drive thumbnails (if needed)
      { protocol: "https", hostname: "**.googleusercontent.com" },
    ],
  },
};

export default nextConfig;
