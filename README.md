# Excel・CSVデータクレンジング・表記統一ツール

Excel / CSVの業務データをブラウザ内でプロファイリングし、問題の検出、列別ルール設定、Before / After確認、Dry Run、クレンジング、検証、Exportまでを一つの流れで実行するLocal-firstのWeb業務効率化ツールです。

- 本番アプリ: [https://excel-csv-data-cleaning-tool.vercel.app](https://excel-csv-data-cleaning-tool.vercel.app)
- ソースコード: [https://github.com/shunsoco-stack/excel-csv-data-cleaning-tool](https://github.com/shunsoco-stack/excel-csv-data-cleaning-tool)
- QA記録: [docs/QA.md](docs/QA.md)
- ポートフォリオ掲載用プロンプト: [docs/PORTFOLIO_ADD_PROMPT.md](docs/PORTFOLIO_ADD_PROMPT.md)

> 入力ファイルの解析、プロファイリング、変換、検証、Exportデータ生成はブラウザ内で実行します。本アプリに入力ファイルや行データをアップロードするAPIはありません。

## Overview

実務の顧客マスタ、商品マスタ、売上データには、同じ意味を持つ値でも空白、文字幅、大小文字、電話番号、郵便番号、日付などの表記が揃っていないことがあります。手作業で直接修正すると、変更箇所を把握できないまま元データを上書きしたり、不正な値を正しい値だと推測して変換したりする危険があります。

本ツールは単純な文字置換ではなく、元データを保持したまま次のData Cleaning Workflowを成立させます。

```text
File Import（CSV / XLSX・Sheet選択）
        ↓
Data Profiling（件数・型・品質指標）
        ↓
Problem Detection（空白・表記・欠損・重複・不正形式）
        ↓
Column Rules / Template（列単位の変換設定）
        ↓
Before / After Preview（変更Cellを強調）
        ↓
Dry Run（変更Cell・削除重複・警告を集計）
        ↓
Clean（原データから分離したコピーへ適用）
        ↓
Validate（列構成・重複・形式・欠損を再確認）
        ↓
Export（CSV / XLSX / Cleaning Report）
```

## 主な機能

- CSV / XLSXのDrag & Drop、File Select、データPreview
- XLSXに含まれる複数Sheetの検出と対象Sheet選択
- 行数、列数、空欄数、重複数、推定データ型、ユニーク値数などのData Profiling
- 空白、全半角、大小文字、電話番号、郵便番号、日付、数値カンマ、欠損値、重複行の検出
- 電話番号列、登録日列、メール列など、列ごとに異なるRuleを設定
- プロファイリング結果に基づく保守的なRule候補の生成
- 元データと変換後データを並べるBefore / After Preview
- 変更Cell、削除予定の重複行、不正値を色とラベルで識別
- 実行前に変更Cell数、重複削除数、警告数を示すDry Run
- 原データを変更しないimmutableなクレンジング処理とRule解除による再実行
- 組み込みTemplateと、ブラウザへ保存できるユーザーTemplate
- クレンジング後の検証DashboardとCSV / XLSX / Cleaning Report出力
- 顧客マスタ、商品マスタ、売上データの3つの架空Demo
- Table + Check + Sparkをモチーフにした専用SVGアイコン

## Data Profiling

読み込んだデータから、次の値をコードで決定論的に算出します。

| 粒度 | 算出項目 |
| --- | --- |
| データ全体 | 行数、列数、空欄Cell数、完全重複行数、ユニーク行数、Issue件数 |
| 列ごと | 空欄数、非空欄数、ユニーク値数、重複値数、Issue件数、Sample値 |
| 型推定 | empty、string、number、date、boolean、phone、postal-code、emailと信頼度 |
| 問題検出 | 前後空白、連続空白、全角文字、半角カナ、大小文字混在、電話・郵便・日付形式、数値カンマ、欠損、重複 |

型推定では列名の意味と値の形を組み合わせます。IDやコードの先頭ゼロは数値へ誤分類しないように扱い、数値の`1`と文字列の`"1"`はユニーク値・重複判定とも別の値として保持します。

## Cleaning Rules

Ruleは対象列ごとに追加し、順番に適用します。電話番号や日付など安全に解釈できない構造化データは推測で書き換えず、元の値を保持して警告します。

| Rule | 実装内容 |
| --- | --- |
| 前後空白削除 | 値の先頭・末尾のUnicode空白を削除 |
| 連続空白整理 | タブ、半角・全角スペースなど横方向の連続空白を半角スペース1つへ統一。改行は保持 |
| 全角→半角 | 英数字、記号、空白、全角カタカナを対応する半角文字へ変換 |
| 半角→全角 | 英数字、記号、空白、半角カタカナを対応する全角文字へ変換 |
| 小文字 / 大文字統一 | 文字列Cellの英字を列単位で統一。数値・booleanは非変換 |
| 電話番号整形 | 対応可能な国内番号と`+81`表記をハイフン区切りへ統一。不明確・不正な値は保持して警告 |
| 郵便番号整形 | 全半角や`〒`を吸収し、正しい7桁だけを`NNN-NNNN`へ統一 |
| 日付形式統一 | `YYYY/M/D`、`YYYY-M-D`、`YYYYMMDD`、日本語年月日、Excel serial date等を`YYYY-MM-DD`へ統一 |
| 数値カンマ除去 | 正しい桁区切りの数値文字列からカンマを除去。不正な数値表現は保持して警告 |
| 空文字 / null統一 | 空文字または空白だけのCellを`null`へ統一。`0`と`false`は保持 |
| 重複削除 | 現在の設定に含まれる判定列、または未指定時は全列の型付き値で判定し、先頭の1行を保持 |

重複判定はCell Ruleの適用後に行うため、表記統一によって同一になった行もDry Runで確認できます。

## Before / After、Dry Run、Undo

クレンジング確定前に、同じ行・列の元データと変換後を並べて表示します。

- Beforeは変更前、Afterは変更後として明示
- 変更Cellは背景色と状態ラベルの両方でHighlight
- 削除予定行は重複元行との関係を保持
- 警告には元データ行、列、値、Rule、理由を保持
- 同じCellへ複数Ruleを適用しても、最初の値と最終値を1変更として集計

`applyCleaning`は入力`DataSet`と元Rowを変更せず、クレンジング済みのコピーを返します。Ruleを無効化・削除して再実行すれば、常に保持された原データからやり直せます。

Dry Runでは次を表示します。

- 元行数 / 出力予定行数
- 変更予定Cell数
- 削除予定重複行数
- 警告件数
- 適用Rule数
- 変換前 / 変換後の空欄数

## Validation Dashboard

クレンジング後のデータを再プロファイリングし、次の観点を`passed`または`warning`で検証します。

- 列構成が維持されているか
- 設定対象の重複が残っていないか
- 安全に変換できなかった電話番号、郵便番号、日付、数値があるか
- 欠損値がいくつ残っているか

完了Dashboardでは修正Cell数、削除重複数、欠損件数、警告件数、出力行数を確認できます。

## Template

標準で次のTemplateを搭載しています。

| Template | 内容 |
| --- | --- |
| 顧客マスタ整形 | 氏名、電話番号、郵便番号、メール、登録日、備考を整形し、顧客ID重複を処理 |
| EC商品データ整形 | 商品コード、商品名、カテゴリ、価格、登録日、備考を整形し、商品コード重複を処理 |

ユーザー独自の設定も名前を付けて`localStorage`へ保存・再利用できます。保存対象はversion、名前、説明、列別Rule、重複Ruleだけです。File byte、Row、Cell値、Preview、クレンジング結果はallow-list外として保存しません。壊れたデータや未対応versionは読み飛ばし、選択中Sheetに必要な列がないTemplateは互換性なしとして扱います。

## Demo Mode

すべて予約済み`.invalid`ドメイン等を使った架空データです。各Demoは実行のたびに原本から分離したコピーを読み込みます。

| Demo | 意図的に含めた問題 |
| --- | --- |
| 顧客マスタ | 氏名の空白、全角電話・郵便番号、メール大小文字、複数日付形式、欠損、不正値、顧客ID重複、完全重複 |
| 商品マスタ | 全角商品コード、商品名・カテゴリの空白、カンマ付き価格、複数日付形式、欠損、不正日付、商品コード重複 |
| 売上データ | 複数日付形式、全角店舗・商品コード、カンマ付き売上金額、担当者名の空白、欠損、不正日付、売上ID重複 |

## Supported Files

| 項目 | 対応範囲 |
| --- | --- |
| CSV | UTF-8（BOM有無）、Shift-JIS fallback |
| 区切り文字 | comma、tab、semicolon、pipeを内容から推定 |
| CSV構文 | quoted delimiter、escaped quote、Cell内改行 |
| XLSX | 複数Sheet、string / number / boolean / date Cell |
| File size | 1ファイル25 MiBまで |
| 非対応 | XLS、ODS、暗号化・パスワード付きWorkbook |

空ファイル、閉じていないCSV引用符、使用可能なHeaderがないデータ、未対応拡張子、サイズ超過は、理由を持つImport Errorとして拒否します。空Headerには`列N`を補完し、重複Headerにはsuffixを付けます。

## Export

| 出力 | 内容 |
| --- | --- |
| `cleaned-data.csv` | UTF-8 BOM付きのクレンジング済みデータ |
| `cleaned-data.xlsx` | クレンジング済みデータを持つ1 SheetのWorkbook |
| `cleaning-report.xlsx` | Summary、Cleaned Data、Changes、Warnings、Removed Duplicates、Rulesの6 Sheet |

内部Row IDはExportへ含めません。CSV / XLSX境界では、空白に続く`=`、`+`、`-`、`@`などで始まる文字列へapostropheを付け、Spreadsheet Formula Injectionを抑止します。

## Local-first / Privacy

- File byteは`File.arrayBuffer()`で取得し、ブラウザ内でCSV / XLSXへ解析
- プロファイリング、問題検出、変換、重複判定、検証、Export生成を端末内で実行
- 入力ファイル、Row、Cell値を本アプリのServerへ送信・永続化しない
- 入力データをURLやAnalytics payloadへ含めない
- Templateには設定だけを保存し、File byteや業務データを保存しない
- Demoは個人情報を含まない架空データ

本項はこのアプリ自身の実装範囲を説明するものです。利用する端末、ブラウザ、拡張機能、Hosting環境の運用ポリシーは別途確認してください。

## Architecture

```text
Next.js App Router / React Client UI
└─ CleaningWorkbench（Workflowと原データ・設定・実行結果の状態管理）
   ├─ file-io.ts          CSV decode / parse、XLSX parse、Sheet抽出
   ├─ profiling.ts        集計、型推定、Issue検出
   ├─ rule-catalog.ts     Rule定義、検出結果からの候補作成
   ├─ cleaning-engine.ts  immutable変換、変更履歴、警告、重複削除
   ├─ validation.ts       Clean後の再プロファイリングと検証
   ├─ template-store.ts   built-in / localStorage Template
   ├─ export.ts           Cleaned CSV / XLSX、Cleaning Report生成
   └─ demo-data.ts        3種類の架空Demoと推奨設定
```

主要処理に生成AIは使用していません。同じ入力・Sheet・Rule順序から同じ結果を返す、監査可能な決定論的処理です。

## UI / Accessibility

- Desktopの情報密度を保ちつつ、Tablet / MobileではWorkflow railとGridを再配置
- system font、サイズ別のtracking / leading、明確な情報階層
- 押下時の即時feedbackと短いtransition
- `focus-visible`、日本語Document language、named control、status / alert表示
- 色だけに依存しないBefore / After、警告、削除状態
- `prefers-reduced-motion`、`prefers-reduced-transparency`、`prefers-contrast`へ対応

## Test

最低要件のTrim、Case、全半角、Date、Phone、Postal Code、Duplicate、Empty、XLSX、CSV、Exportを含む自動テストを用意しています。

2026-08-24時点で、ESLint、TypeScript、47 tests、Production buildがすべてPASSしました。Local browserではCSV、複数Sheet XLSX、3 Demo、Dry Run、Undo相当の再実行、Template、CSV / XLSX / Cleaning Report Exportを確認し、axeの自動監査はviolations 0でした。Vercel Productionでは顧客Demoの主要Workflow完走、商品・売上Demo、実CSV、複数Sheet XLSX、Local-firstのNetwork log、5枚のScreenshotを確認しています。詳細は[docs/QA.md](docs/QA.md)で記録します。

| Test area | 主な検証内容 |
| --- | --- |
| Cleaning Engine | 全Rule、Rule順序、変更Cell集計、警告、選択列重複、keep-first / last、原データ不変、Undo相当の再実行 |
| Profiling | 行・列・空欄・重複・unique、型推定、Issue位置、型付き値の区別 |
| CSV / XLSX | UTF-8 / Shift-JIS、delimiter、quote、複数Sheet、日付・型、空Header、size / format validation |
| Rule Recommendation | Profile Issueからの重複しない列別Rule候補 |
| Template | 組み込みTemplate、設定だけの保存、破損値拒否、列互換性、保存・更新・削除 |
| Export | CSV / XLSX再読込、6 Sheet Report、internal ID除外、Formula Injection対策 |
| Validation / Demo | 未解決形式・欠損・重複、3 Demoの意図的なdirty dataと再読込時の原状復帰 |

Quality Gate:

```bash
npm run verify
```

個別実行:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

本番環境での手動確認項目とScreenshot取得要件は[docs/QA.md](docs/QA.md)に記録します。

## Production Screenshots

Vercel Productionの実画面から取得する5枚は、次のpathへ統一します。

| Workflow state | Screenshot |
| --- | --- |
| Data Profiling | [`docs/screenshots/01-data-profiling.png`](docs/screenshots/01-data-profiling.png) |
| Rule設定 | [`docs/screenshots/02-rule-settings.png`](docs/screenshots/02-rule-settings.png) |
| Before / After | [`docs/screenshots/03-before-after-preview.png`](docs/screenshots/03-before-after-preview.png) |
| Dry Run | [`docs/screenshots/04-dry-run-result.png`](docs/screenshots/04-dry-run-result.png) |
| Dashboard / Export | [`docs/screenshots/05-dashboard-export.png`](docs/screenshots/05-dashboard-export.png) |

## Development

必要環境はNode.js 22以上です。

```bash
npm ci
npm run dev
```

ブラウザで表示されたLocal URLを開き、初期表示のDemoまたは手元のCSV / XLSXでWorkflowを確認してください。

## Dedicated Icon

- App icon: `src/app/icon.svg`
- Reusable asset: `public/icons/data-cleaning-mark.svg`
- Motif: Table + Check + Spark

## License / Data Handling Note

公開前にRepositoryのLicense設定を確認してください。機密情報や個人情報を含む実ファイルでは、組織の情報管理規程、端末管理、ブラウザ拡張機能、ダウンロード先の権限もあわせて確認してください。
