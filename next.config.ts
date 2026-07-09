import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const supabaseHostname = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      ...(supabaseHostname
        ? [
            {
              protocol: "https" as const,
              hostname: supabaseHostname,
              pathname: "/storage/v1/object/public/offers/**",
            },
          ]
        : []),
      {
        protocol: "https",
        hostname: "www.koluj.cz",
      },
      {
        protocol: "https",
        hostname: "koluj.cz",
      },
    ],
  },

  async headers() {
    const securityHeaders = [
      {
        key: "Content-Security-Policy",
        value: [
          "default-src 'self'",
          "base-uri 'self'",
          "object-src 'none'",
          "frame-ancestors 'none'",
          "form-action 'self'",
          "manifest-src 'self'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob: https:",
          "font-src 'self' data:",
          "media-src 'self' data: blob: https:",
          "connect-src 'self' https: wss:",
          "worker-src 'self' blob:",
          "upgrade-insecure-requests",
        ].join("; "),
      },
      {
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      },
      {
        key: "X-Frame-Options",
        value: "DENY",
      },
      {
        key: "X-Content-Type-Options",
        value: "nosniff",
      },
      {
        key: "Referrer-Policy",
        value: "strict-origin-when-cross-origin",
      },
      {
        key: "Permissions-Policy",
        value: [
          "camera=()",
          "microphone=()",
          "payment=()",
          "usb=()",
          "magnetometer=()",
          "gyroscope=()",
          "geolocation=(self)",
        ].join(", "),
      },
    ];

    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },

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

export default withBundleAnalyzer(
  withSentryConfig(nextConfig, {
    org: "koluj",
    project: "javascript-nextjs",

    silent: !process.env.CI,

    widenClientFileUpload: true,

    webpack: {
      automaticVercelMonitors: true,
      treeshake: {
        removeDebugLogging: true,
      },
    },
  })
);