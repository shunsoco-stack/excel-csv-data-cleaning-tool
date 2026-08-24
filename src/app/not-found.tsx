import Link from "next/link";

export default function NotFound() {
  return (
    <main className="error-shell">
      <div className="error-card">
        <span className="eyebrow">404</span>
        <h1>ページが見つかりません</h1>
        <Link className="button primary" href="/">ツールへ戻る</Link>
      </div>
    </main>
  );
}
