import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "ReliantOutreach",
    short_name: "ReliantOutreach",
    description: "Manage campaigns, replies and outreach conversations.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: "#f4f7fb",
    theme_color: "#123477",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/app-icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/app-icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/app-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
