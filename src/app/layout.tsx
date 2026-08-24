import type { Metadata, Viewport } from "next";
import "./globals.css";

const appName = "Excel・CSVデータクレンジング・表記統一ツール";

export const metadata: Metadata = {
  title: appName,
  description:
    "Excel・CSVの業務データをブラウザ内でプロファイリングし、列別ルールで安全にクレンジングできるLocal-firstツール。",
  applicationName: appName,
  keywords: ["Excel", "CSV", "データクレンジング", "表記統一", "業務効率化"],
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#f5f7fb",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
