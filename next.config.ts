import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/analyze/:path*',
        destination: `${process.env.NEXT_PUBLIC_DASHBOARD_URL}/api/analyze/:path*`,
      },
    ];
  },
};

export default nextConfig;
