import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/arena", destination: "/swarm", permanent: true },
      { source: "/arena/:path*", destination: "/swarm/:path*", permanent: true },
    ];
  },
};

export default nextConfig;
