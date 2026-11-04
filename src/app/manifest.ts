import type { MetadataRoute } from "next";
import { withBasePath } from "@/config/base-path";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: withBasePath("/"),
    name: "Seasia Gala Event",
    short_name: "Seasia Gala",
    description: "Seasia Gala Event Management",
    start_url: withBasePath("/admin-login"),
    scope: `${withBasePath("/").replace(/\/$/, "")}/`,
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#e879a5",
    icons: [
      {
        src: withBasePath("/icons/icon-192.png"),
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: withBasePath("/icons/icon-512.png"),
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
