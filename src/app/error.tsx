"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="error-shell">
      <div className="error-card">
        <span className="eyebrow">予期しないエラー</span>
        <h1>画面を正しく表示できませんでした</h1>
        <p>原データは端末内で保持されています。画面を再読み込みしてもう一度お試しください。</p>
        <button className="button primary" onClick={reset}>もう一度試す</button>
      </div>
    </main>
  );
}
