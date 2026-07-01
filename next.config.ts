import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/items", destination: "/offers", permanent: true },
      { source: "/items/new", destination: "/offers/new", permanent: true },
      { source: "/items/:path*", destination: "/offers/:path*", permanent: true },
      { source: "/dashboard/my-items", destination: "/dashboard/my-offers", permanent: true },
      { source: "/dashboard/loans", destination: "/dashboard/bookings", permanent: true },
      { source: "/dashboard/loans/:path*", destination: "/dashboard/bookings/:path*", permanent: true },
    ];
  },
};

export default nextConfig;