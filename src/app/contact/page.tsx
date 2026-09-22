import type { Metadata } from "next";
import Link from "next/link";

import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "お問い合わせ",
};

export default function ContactPage() {
  return (
    <>
      <main className="legal-page">
        <Link className="legal-back" href="/">← アプリへ戻る</Link>
        <h1>お問い合わせ</h1>
        <p>不具合の報告や改善要望は、GitHubリポジトリのIssuesからお知らせください。入力ファイルや実データなどの機密情報は添付しないでください。</p>
        <a className="button primary legal-contact-link" href="https://github.com/shunsoco-stack/excel-csv-data-cleaning-tool/issues" target="_blank" rel="noopener noreferrer">
          GitHub Issuesを開く
        </a>
      </main>
      <SiteFooter />
    </>
  );
}
