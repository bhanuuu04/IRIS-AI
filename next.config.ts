import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const backendUrl = process.env.NEXT_PUBLIC_DASHBOARD_URL;
    return [
      // Flask backend routes — proxied to Railway
      { source: '/api/analyze/:path*',       destination: `${backendUrl}/api/analyze/:path*` },
      { source: '/api/top_risky',            destination: `${backendUrl}/api/top_risky` },
      { source: '/api/top_risky/:path*',     destination: `${backendUrl}/api/top_risky/:path*` },
      { source: '/api/search',               destination: `${backendUrl}/api/search` },
      { source: '/api/generate_insight',     destination: `${backendUrl}/api/generate_insight` },
      // Note: /api/razorpay/* and /api/webhooks/* and /api/user/* are handled by Next.js — NOT proxied
    ];
  },
};

export default nextConfig;
