import type { Metadata } from "next";
import Link from "next/link";

import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "プライバシーポリシー",
  description: "広告配信（忍者AdMax）と、このアプリが扱うデータについて。",
};

export default function PrivacyPage() {
  return (
    <>
      <main className="legal-page">
        <Link className="legal-back" href="/">← アプリへ戻る</Link>
        <h1>プライバシーポリシー</h1>
        <p>本アプリは、Excel・CSVファイルの読込、解析、変換、検証、出力を利用者のブラウザ内で行います。入力したファイルや表データを本アプリのサーバーへ送信・保存しません。</p>
        <p>あなたが読み込んだファイルやその処理結果は外部サーバーへ送信しません。広告用スクリプトの読み込みは、ファイルの内容とは無関係です。</p>

        <h2>広告配信（忍者AdMax）とオプトアウト</h2>
        <p>
          本番環境のトップページ末尾では、忍者ツールズ株式会社が提供する広告配信サービス「忍者AdMax」を利用しています。忍者AdMaxおよびその提携事業者は、広告の配信、効果測定、不正防止などのため、Cookie等の技術を利用して、アクセス日時、閲覧したページのURL、リファラー、IPアドレス、ブラウザ・端末に関する情報などを取得する場合があります。取得された情報は、各事業者のプライバシーポリシー等に従って取り扱われます。
        </p>
        <p>
          Cookie等による情報の取得を望まない場合は、ブラウザの設定でCookieを無効にする、または削除することで拒否（オプトアウト）できます。ただし、一部の機能が正常に利用できなくなる場合があります。オプトアウトの方法と提携事業者については、忍者ツールズの
          <a href="https://corp.ninja.co.jp/privacy/cookie/" target="_blank" rel="noopener noreferrer">
            「Cookie等の技術や広告用IDの利用について」
          </a>
          を、個人情報の取扱いについては
          <a href="https://corp.ninja.co.jp/privacy/" target="_blank" rel="noopener noreferrer">
            忍者ツールズのプライバシーポリシー
          </a>
          をご確認ください。
        </p>

        <h2>保存する情報</h2>
        <p>テンプレート機能では、利用者が保存した列名とクレンジングRuleのみをブラウザのLocal Storageへ保存します。ファイル内容、行データ、セル値は保存対象に含みません。</p>
      </main>
      <SiteFooter />
    </>
  );
}
