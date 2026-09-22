import type { Metadata } from "next";
import Link from "next/link";

import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "プライバシーポリシー",
};

export default function PrivacyPage() {
  return (
    <>
      <main className="legal-page">
        <Link className="legal-back" href="/">← アプリへ戻る</Link>
        <h1>プライバシーポリシー</h1>
        <p>本アプリは、Excel・CSVファイルの読込、解析、変換、検証、出力を利用者のブラウザ内で行います。入力したファイルや表データを本アプリのサーバーへ送信・保存しません。</p>

        <h2>広告配信について</h2>
        <p>本アプリでは、サービスの維持・運営のため、i-mobileなどの広告配信サービスを利用する場合があります。広告配信事業者は、広告の表示・効果測定などのためにCookie等を使用する場合があります。</p>
        <p>広告タグが設定されていない場合は、i-mobile広告を読み込まず、自社サービスの案内を表示します。</p>

        <h2>保存する情報</h2>
        <p>テンプレート機能では、利用者が保存した列名とクレンジングRuleのみをブラウザのLocal Storageへ保存します。ファイル内容、行データ、セル値は保存対象に含みません。</p>

        <h2>外部サイト</h2>
        <p>広告や関連サービスへのリンク先で行われる情報の取扱いは、各サービスのプライバシーポリシーをご確認ください。</p>
      </main>
      <SiteFooter />
    </>
  );
}
