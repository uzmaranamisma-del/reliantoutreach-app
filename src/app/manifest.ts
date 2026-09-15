import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
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
        src: "/brand-logo.png",
        sizes: "2172x724",
        type: "image/png",
      },
    ],
  };
}
