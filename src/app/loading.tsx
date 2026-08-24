export default function Loading() {
  return (
    <main className="loading-shell" aria-busy="true" aria-label="読み込み中">
      <div className="loading-mark" />
      <p>ワークスペースを準備しています…</p>
    </main>
  );
}
