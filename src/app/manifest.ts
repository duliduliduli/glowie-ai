import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Glowie",
    short_name: "Glowie",
    description: "Your AI stylist for outfits, hair and makeup.",
    start_url: "/home",
    display: "standalone",
    background_color: "#f2f3f5",
    theme_color: "#f2f3f5",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
