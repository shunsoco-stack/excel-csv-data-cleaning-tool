import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <p>© 2026 Excel・CSVデータクレンジング・表記統一ツール</p>
      <nav aria-label="フッター">
        <Link href="/privacy/">プライバシーポリシー</Link>
        <Link href="/contact/">お問い合わせ</Link>
      </nav>
    </footer>
  );
}
