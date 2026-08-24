import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Excel・CSVデータクレンジング・表記統一ツール",
    short_name: "データクレンジング",
    description: "Excel・CSVを端末内で安全に分析・整形する業務効率化ツール",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f7fb",
    theme_color: "#2563eb",
    icons: [
      { src: "/icons/data-cleaning-mark.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
