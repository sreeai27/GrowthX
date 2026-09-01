import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hunar OS",
    short_name: "Hunar OS",
    description: "Source-backed exception resolution for frontline work.",
    start_url: "/hunar-os",
    display: "standalone",
    background_color: "#fcfbf7",
    theme_color: "#17324d",
  };
}
