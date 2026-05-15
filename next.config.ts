import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Webflow CDN — actual domain used for uploaded assets
      { protocol: "https", hostname: "cdn.prod.website-files.com" },
      { protocol: "https", hostname: "**.webflow.com" },
      { protocol: "https", hostname: "**.webflowcdn.com" },
      // Google Docs / Drive thumbnails (if needed)
      { protocol: "https", hostname: "**.googleusercontent.com" },
    ],
  },
};

export default nextConfig;
