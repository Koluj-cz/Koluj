import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.koluj.cz";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/dashboard",
          "/dashboard/",
          "/dashboard/:path*",
          "/profile",
          "/profile/",
          "/profile/:path*",
          "/login",
          "/auth/",
          "/auth/:path*",
          "/api/",
          "/api/:path*",
        ],
      },
    ],
    sitemap: `${siteUrl.replace(/\/$/, "")}/sitemap.xml`,
  };
}
