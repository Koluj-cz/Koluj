import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KOLUJ",
    short_name: "KOLUJ",
    description: "Půjčuj si věci od lidí ve svém okolí",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#efebdd",
    theme_color: "#6b7f32",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}