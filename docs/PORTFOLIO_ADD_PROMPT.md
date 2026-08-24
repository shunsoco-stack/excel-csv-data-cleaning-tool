# ポートフォリオ掲載用・完全版プロンプト

この文書は、完成した「Excel・CSVデータクレンジング・表記統一ツール」を既存ポートフォリオへ追加するときに使用する、事実確認を前提とした実装プロンプトです。

本番URLとGitHub Repositoryは公開済みです。ポートフォリオ掲載時は、下記の一次情報とProduction Screenshotを参照してください。

## 掲載情報

| 項目 | 内容 |
| --- | --- |
| 作品名 | Excel・CSVデータクレンジング・表記統一ツール |
| カテゴリ | 業務効率化ツール |
| サブカテゴリ | データクレンジング |
| 本番URL | `https://excel-csv-data-cleaning-tool.vercel.app` |
| GitHub Repository | `https://github.com/shunsoco-stack/excel-csv-data-cleaning-tool` |
| README | `https://github.com/shunsoco-stack/excel-csv-data-cleaning-tool#readme` |
| QA | `docs/QA.md` |
| 専用Icon | `public/icons/data-cleaning-mark.svg` / `src/app/icon.svg` |

## 一覧カード用コピー

### Title

Excel・CSVデータクレンジング・表記統一ツール

### Short description

Excel / CSVをブラウザ内でプロファイリングし、列別Rule、Before / After、Dry Run、検証、Exportまでを安全につなぐLocal-firstのデータクレンジングツール。

### Tags

`Next.js` `React` `TypeScript` `SheetJS` `CSV` `XLSX` `Data Profiling` `Data Cleaning` `Before / After` `Dry Run` `Local-first` `Template`

### CTA

- Demo: `https://excel-csv-data-cleaning-tool.vercel.app`
- GitHub: `https://github.com/shunsoco-stack/excel-csv-data-cleaning-tool`

## 詳細ページ用・要約

「Excel・CSVデータクレンジング・表記統一ツール」は、Excel / CSVの業務データに含まれる空白、全半角、大小文字、電話番号、郵便番号、日付、数値カンマ、欠損、重複などを検出し、元データを保持したまま列別Ruleで整形できるWeb業務効率化ツールです。

File Import、Data Profiling、Problem Detection、Rule設定、Before / After Preview、Dry Run、Clean、Validate、Export、Template再利用を一続きのData Cleaning Workflowとして実装しています。入力File、Row、Cell値は本アプリのServerへ送信せず、解析からExport生成までをブラウザ内で処理します。

## 既存ポートフォリオへ追加するための完全版Prompt

```text
既存ポートフォリオへ、次の作品を新規追加してください。

作品名:
Excel・CSVデータクレンジング・表記統一ツール

カテゴリ:
業務効率化ツール

サブカテゴリ:
データクレンジング

本番URL:
https://excel-csv-data-cleaning-tool.vercel.app

GitHub Repository:
https://github.com/shunsoco-stack/excel-csv-data-cleaning-tool

参照する一次情報:
- https://excel-csv-data-cleaning-tool.vercel.app の完成アプリ
- https://github.com/shunsoco-stack/excel-csv-data-cleaning-tool のREADME.md
- https://github.com/shunsoco-stack/excel-csv-data-cleaning-tool のpackage.json
- https://github.com/shunsoco-stack/excel-csv-data-cleaning-tool のdocs/QA.md
- https://github.com/shunsoco-stack/excel-csv-data-cleaning-tool の実装Sourceと自動Test
- 専用Icon: public/icons/data-cleaning-mark.svg
- Vercel Productionの実画面から取得した次のScreenshot 5枚
  1. docs/screenshots/01-data-profiling.png
  2. docs/screenshots/02-rule-settings.png
  3. docs/screenshots/03-before-after-preview.png
  4. docs/screenshots/04-dry-run-result.png
  5. docs/screenshots/05-dashboard-export.png

掲載実装の方針:
1. 既存ポートフォリオのDesign System、Layout、Responsive behavior、Component規約を維持し、この作品だけの独自ブランド名を付けない。
2. 作品名は必ず「Excel・CSVデータクレンジング・表記統一ツール」とし、省略名を正式名称として扱わない。
3. カテゴリは「業務効率化ツール」、サブカテゴリは「データクレンジング」とする。
4. 元の開発仕様や依頼文ではなく、完成アプリ、README、package.json、Source、Test、GitHub、Production、Screenshotで確認できる実装済み機能だけを書く。
5. 単なる文字置換Toolではなく、Profile → Detect → Rule → Preview → Clean → Validate → Export → Templateを成立させたData Cleaning Workflowとして紹介する。
6. File ImportとXLSX複数Sheet選択、Data Profiling、列別Rule、Before / After、Dry Run、Undo相当の再実行、Template、Validation Dashboard、Exportを主要機能として説明する。
7. Data Profilingでは行数、列数、空欄数、重複数、推定Data Type、型信頼度、列別unique値数、Issue件数をコードで算出する点を記載する。
8. Ruleは前後空白、連続空白、全角→半角、半角→全角、大小文字、電話番号、郵便番号、日付YYYY-MM-DD、数値カンマ、空文字/null、重複削除に対応する点を記載する。
9. 電話番号、郵便番号、日付、数値の不正値を推測で書き換えず、元値を保持して警告するfail-closed設計を強調する。
10. Cell Rule後に、設定済みの判定列（未指定時は全列）の型付き値で重複を判定し、Dry Runへ削除予定行を出す点を説明する。
11. 元DataSetを直接変更せず、変換済みコピー、変更Cell、警告、削除重複を返すimmutable / deterministicなEngineであることを説明する。
12. Before / Afterでは変更CellをHighlightし、Dry Runで変更予定Cell数、削除予定重複数、警告数、出力予定行数を確認してからCleanできる点を説明する。
13. 組み込みTemplate「顧客マスタ整形」「EC商品データ整形」と、設定だけをlocalStorageへ保存するユーザーTemplateを紹介する。File byte、Row、Cell値はTemplateへ保存しない。
14. 顧客マスタ、商品マスタ、売上データの3 Demoを紹介する。すべて架空Dataで、空白、表記ゆれ、欠損、不正値、重複を意図的に含む。
15. CSVはUTF-8 / Shift-JIS、comma / tab / semicolon / pipe、quoted fieldに対応し、XLSXは複数Sheetとprimitive / date Cellに対応する。XLSやODSを対応済みと書かない。
16. Cleaned CSV、Cleaned XLSX、Cleaning Report XLSXを紹介する。XLSX ReportはSummary、Cleaned Data、Changes、Warnings、Removed Duplicates、Rulesの6 Sheetである。
17. Spreadsheet Formula Injection対策と、internal Row IDをExportしない設計を技術的な品質として紹介する。
18. File解析、Profile、Rule実行、Validation、Export生成はブラウザ内で完結し、入力Fileや業務Dataを本アプリのServerへ送信しないLocal-first設計を明記する。
19. 主要処理に生成AIを使わない、同じ入力とRule順序から同じ結果を返す決定論的Toolであることを明記する。
20. Test実績はdocs/QA.mdでPASSになっている項目・件数だけを掲載する。PENDING、未実施、未確認の項目を成功実績へ書き換えない。
21. Production QAもdocs/QA.mdで実施済みの項目だけを書く。Localhostの確認をProduction確認として扱わない。
22. Main thumbnailには01-data-profiling.pngを使用する。詳細ページでは5枚をWorkflow順に配置し、各画像へ内容を示す日本語alt textを付ける。
23. DemoとGitHubのCTAを一覧Cardと詳細ページの両方に配置し、外部Linkであることが分かるようにする。
24. Desktop / MobileでLink切れ、画像切れ、Console Error、Layout overflowがないことを確認する。

推奨する詳細ページ構成:
1. Hero — 作品名、Short description、Demo / GitHub CTA、Main screenshot
2. 課題 — 手作業による表記統一の見落とし、原データ上書き、変換根拠不足
3. Workflow — Import → Profile → Detect → Rule → Preview → Dry Run → Clean → Validate → Export → Template
4. Data Profiling / Problem Detection — 集計指標、型推定、Issue検出
5. Column Rules — 電話番号、登録日、メール等の列別設定とfail-closed変換
6. Before / After / Dry Run — 変更Cell、重複削除、警告の事前確認
7. Local-first / Undo / Template — 原データ保持、設定だけの保存、再実行
8. Validation / Export — DashboardとCSV / XLSX / Report
9. Demo — 顧客、商品、売上の3種類
10. Architecture / Quality — deterministic Engine、File I/O、Formula Injection対策、Test
11. Screenshots — Production実画面5枚
12. CTA — Demoを試す / Sourceを見る

推奨Short description:
「Excel / CSVをブラウザ内でプロファイリングし、列別Rule、Before / After、Dry Run、検証、Exportまでを安全につなぐLocal-firstのデータクレンジングツール。」

技術的な見どころとして優先する内容:
- Data ProfilingをUI表示用の固定値ではなく入力Dataから算出すること
- Profile Issueから保守的な列別Rule候補を作ること
- 変換不能な構造化Dataを元値保持 + warningにすること
- 複数Rule後の最終値と原値からCell変更を一意に集計すること
- Cell Rule後に重複を判定し、正規化で生じた重複もDry Runへ出すこと
- 原データを変更しないためRule解除・再実行が可能なこと
- Template永続化にstrict allow-listを使い、業務Dataを保存しないこと
- Export時のFormula Injection対策とReportの監査情報

Screenshot alt text:
1. 「Excel・CSVデータの行数・列数・空欄・重複・列別型を表示するData Profiling画面」
2. 「電話番号・登録日・メールなどへ列別クレンジングRuleを設定する画面」
3. 「変更Cellを強調して元データと変換後を比較するBefore / After Preview」
4. 「変更予定Cell数・削除予定重複数・警告件数を示すDry Run結果」
5. 「修正Cell・欠損・警告の完了DashboardとCSV・XLSX・Report Export」

実装後の確認:
- Production URLとGitHub URLが正しい
- 5枚のScreenshotが指定pathに存在し、Production実画面である
- README、package.json、Source、Test、QA、掲載文の機能説明が一致する
- 本番でDemoと主要Workflowが動作する
- Desktop / Mobileで画像、Text、CTA、外部Linkが正常
- Browser consoleにerrorがない
```

## 掲載本文の素材

### 解決する課題

顧客、商品、売上などの業務データは、入力元や担当者が異なるだけで、空白、文字幅、大小文字、電話・郵便・日付形式、欠損、重複が混在します。表計算ソフトで直接編集する方法では、変更範囲と根拠が見えにくく、原データの上書きや不正値の誤変換が起きやすくなります。

本作は入力データをまずProfileし、問題を位置付きで検出し、列単位のRuleを設定してBefore / AfterとDry Runを確認したうえでCleanします。変換後も重複、形式、欠損を再検証し、監査可能なReportとともにExportできます。

### 差別化

一般的な文字置換ToolやFormat Converterとの違いは、入力品質の可視化、列別Rule、変更Cell単位のPreview、実行前集計、警告のfail-closed処理、原データを保持したUndo相当の再実行、設定Template、Clean後Validationまでを一つのWorkflowとして統合している点です。

### 技術要約

- Next.js / React / TypeScript
- SheetJSによるXLSX import / export
- encoding-japaneseによるShift-JIS fallback
- 決定論的なProfiling / Cleaning / Validation Engine
- `localStorage`へ設定だけを保存するversioned Template
- Vitest / Testing LibraryによるRule、I/O、Profile、Template、Export、Workflow検証
- Vercel Production

## 公開後の最終チェック

- [x] Production URLを`https://excel-csv-data-cleaning-tool.vercel.app`へ統一
- [x] GitHub公開URLを`https://github.com/shunsoco-stack/excel-csv-data-cleaning-tool`へ統一
- [x] README、QA、このPromptにURL placeholderが残っていない
- [x] Production実画面のScreenshot 5枚を指定pathへ保存
- [x] Production / Repository / README / Screenshot pathを確認
- [x] QAでPASSの項目と掲載実績が一致
- [x] Category / Subcategory / 正式作品名が完全一致
