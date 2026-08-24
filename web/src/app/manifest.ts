import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "OpenAsset",
    short_name: "OpenAsset",
    description: "Permissionless asset lending markets.",
    start_url: "/markets",
    display: "standalone",
    background_color: "#F7FAFC",
    theme_color: "#F7FAFC",
    icons: [
      {
        src: "/openasset-icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/openasset-icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
