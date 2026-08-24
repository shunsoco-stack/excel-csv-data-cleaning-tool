# QA Checklist

- 対象: **Excel・CSVデータクレンジング・表記統一ツール**
- Production: [https://excel-csv-data-cleaning-tool.vercel.app](https://excel-csv-data-cleaning-tool.vercel.app)
- Repository（Public）: [https://github.com/shunsoco-stack/excel-csv-data-cleaning-tool](https://github.com/shunsoco-stack/excel-csv-data-cleaning-tool)
- 記録日: 2026-08-24

> このファイルは、自動テスト、ローカルProduction build、Vercel Productionの実ブラウザ検証、公開前Secret Scanを分けて記録するためのチェックリストです。未確認項目を推測でPASSに変更しないでください。

## Release Gate

| Gate | Status | Evidence |
| --- | --- | --- |
| Dependency install | PASS | `npm install`完了、`npm audit` 0 vulnerabilities |
| ESLint | PASS | `npm run lint` exit 0 |
| TypeScript | PASS | `npm run typecheck` exit 0 |
| Unit / Component tests | PASS | 9 files / 47 tests |
| Production build | PASS | `npm run build` exit 0 |
| Local browser smoke | PASS | CSV、XLSX multi-sheet、3 Demo、Dry Run、Undo、Template、Exports |
| Local axe audit | PASS | violations 0 |
| Vercel Production deploy | PASS | `https://excel-csv-data-cleaning-tool.vercel.app` |
| Production workflow smoke | PASS | 顧客DemoでProfile → Detect → Rule → Preview → Dry Run → Clean → Validate → Exportを完走 |
| Secret Scan | PASS | Gitleaks 8.30.1、main全履歴、0 findings |
| GitHub public repository | PASS | `shunsoco-stack/excel-csv-data-cleaning-tool`、Public、default `main` |
| Production screenshots 5枚 | PASS | Vercel Production、1440 × 1000、PNG 5枚を目視確認 |

一括Quality Gate:

```bash
npm run verify
```

## Automated Test Acceptance Matrix

| Requirement | Test focus | Status |
| --- | --- | --- |
| Trim | Unicodeの前後空白を削除し、number / boolean / nullを保持 | PASS |
| Case | lower / upper、非文字列Cellを非変換 | PASS |
| 全半角 | ASCII、記号、空白、カタカナ、濁点の双方向変換 | PASS |
| Date | 対応文字列、全角、Excel serial、うるう日、不正日のfail-closed | PASS |
| Phone | 携帯、固定、フリーダイヤル、`+81`、不正値の保持と警告 | PASS |
| Postal Code | 7桁を`NNN-NNNN`化し、不正桁を保持・警告 | PASS |
| Duplicate | 指定列 / 全列、keep-first / last、型付き値、変換後判定 | PASS |
| Empty | 空文字・空白をnullへ統一し、`0` / `false`を保持 | PASS |
| XLSX | 複数Sheet、使用不能Sheetのskip、string / number / boolean / date | PASS |
| CSV | UTF-8 / Shift-JIS、BOM、delimiter、quoted field、Cell内改行 | PASS |
| Export | CSV / XLSX再読込、Report、internal ID除外、Formula Injection対策 | PASS |
| Profiling | 行・列・空欄・重複・unique・型推定・Issue座標 | PASS |
| Template | built-in、localStorage allow-list、互換性、破損値拒否 | PASS |
| Undo / immutable | 入力不変、Rule解除後に原データから再実行 | PASS |
| Validation | 列構成、残存重複、形式警告、欠損を再集計 | PASS |
| Demo | 顧客 / 商品 / 売上、dirty data、架空データ、再読込時の原状復帰 | PASS |

自動テスト実行環境:

```text
Node.js: v24.18.0
npm: 11.16.0
Test files: 9
Tests: 47 passed
Duration: 未記録
```

## Manual QA — Local Production Build

- [x] `npm run build`がerror / warningなしで完了する
- [x] Production相当の起動でblank pageやFramework error overlayがない
- [x] Browser consoleにuncaught errorがない
- [x] Network error、404 asset、hydration mismatchがない
- [x] App名が「Excel・CSVデータクレンジング・表記統一ツール」と表示される
- [x] 専用Table + Check + SparkアイコンがHeader / faviconで表示される
- [x] Desktop viewportで主要Workflowと表が欠けない
- [x] 390 × 844前後のMobile viewportでdocument全体の横overflowがない
- [ ] KeyboardだけでDemo読込、Rule操作、Preview、Clean、Exportまで移動できる
- [ ] focus indicatorが見え、status / warningが色だけに依存しない
- [ ] `prefers-reduced-motion`で不要な移動Animationが抑制される
- [ ] 200% zoomで情報・操作が欠落しない

## Manual QA — File Import / Profiling

### CSV

- [x] UTF-8 CSVを読込み、Header、Row、Cellが一致する
- [ ] UTF-8 BOM付きCSVを読込み、BOMがHeaderへ混入しない
- [ ] Shift-JIS CSVをfallback decodeできる
- [ ] comma / tab / semicolon / pipeを期待どおり判定する
- [ ] quoted delimiter、escaped quote、Cell内改行を保持する
- [ ] 空ファイル、引用符未完了、Headerなし、25 MiB超過、未対応formatを理由付きで拒否する

### XLSX

- [x] 2つ以上の有効Sheetを持つXLSXを読み込む
- [x] Sheet一覧が表示され、選択に応じてProfile / Preview / Rule候補が切り替わる
- [ ] string / number / boolean / date Cellを期待する型・値で保持する
- [ ] Headerを持たないSheetを安全にskipする
- [ ] 有効SheetがないWorkbookを理由付きで拒否する

### Data Profiling

- [x] 行数・列数が元データと一致する
- [x] 空文字、空白のみ、nullを空欄として集計する
- [x] 完全重複行数とユニーク行数が一致する
- [x] 各列の空欄数、unique値数、重複値数が一致する
- [x] string / number / date / boolean / phone / postal-code / emailの型推定が表示される
- [x] 前後空白、連続空白、全半角、mixed case、電話、郵便、日付、numeric comma、欠損、重複Issueを確認できる
- [x] Issueの行・列位置と候補Ruleが実データと一致する

## Manual QA — Rules / Preview / Dry Run

- [ ] Profileから生成したRule候補が列単位になっている
- [ ] 任意の列とRuleを選んで追加できる
- [ ] 複数Ruleの順序が実行結果に反映される
- [ ] Ruleを個別に有効 / 無効化できる
- [ ] Ruleを削除し、保持された原データから再計算できる
- [x] 電話番号列へ電話番号整形を設定できる
- [x] 登録日列へ`YYYY-MM-DD`統一を設定できる
- [x] メール列へTrim / 小文字化を設定できる
- [x] 重複削除Ruleを有効 / 無効化でき、現在の設定に含まれる判定列を画面で確認できる
- [x] Before / Afterが同じ行・列の値を正しく表示する
- [x] 変更Cellが背景色だけでなく状態でも識別できる
- [x] 削除予定の重複行と重複元行を確認できる
- [x] 変換不能な電話・郵便・日付・数値は元値を保持し、警告理由を表示する
- [x] Dry Runの変更Cell数、削除重複数、警告数、出力予定行数が明細と一致する

## Manual QA — Clean / Validate / Undo

- [x] Clean実行前に原データが保持されている
- [x] Clean後Dashboardの修正Cell数、削除重複数、欠損件数、警告件数がDry Runと整合する
- [x] 列構成、重複、形式、欠損のValidation結果が表示される
- [x] Ruleを解除して再実行すると該当変更だけが取り消される
- [x] 全Ruleを解除すると元Row・元Cell値へ戻る
- [x] Demoを再読込すると初期状態へ戻る
- [x] 別Sheetへ切り替えた際、前SheetのClean結果を誤表示しない

## Manual QA — Template

- [x] 組み込みの「顧客マスタ整形」を顧客Demoへ適用できる
- [x] 組み込みの「EC商品データ整形」を商品Demoへ適用できる
- [x] 現在のRule設定を任意名のTemplateとして保存できる
- [x] Page reload後もユーザーTemplateを読み込める
- [x] ユーザーTemplateを削除でき、組み込みTemplateは削除されない
- [x] 必要列がないSheetでは互換性なしとして扱う
- [x] `localStorage[data-cleaning-templates-v1]`に設定以外のRow、Cell値、File byte、Preview、Resultがない
- [ ] 壊れたJSONや未対応versionでもApp全体が壊れない

## Manual QA — Export

- [x] `cleaned-data.csv`をdownloadし、UTF-8 BOM、Header、Row、値を再読込して確認する
- [x] `cleaned-data.xlsx`をdownloadし、Sheet名、Header、型、値を再読込して確認する
- [x] `cleaning-report.xlsx`に6 Sheetが指定順で存在する
- [ ] Summaryの行数、修正Cell、削除重複、警告、Rule数がDashboardと一致する
- [ ] Changesに元行、列、Before、After、Rule IDがある
- [ ] Warningsにcode、message、元行、列、値、Rule IDがある
- [ ] Removed Duplicatesに削除行、重複元行、判定列、判定値、元Rowがある
- [ ] Rulesに列、Rule、状態、重複設定がある
- [ ] internal `__rowId`がどの出力にも含まれない
- [ ] `=`, `+`, `-`, `@`で始まる式風文字列がSpreadsheetで式実行されない

## Production QA Checklist

VercelのProduction URL `https://excel-csv-data-cleaning-tool.vercel.app` に対して実施し、Browser、Viewport、時刻、Deploymentを記録してください。以下はLocal QAのPASS項目とは分離し、Productionで再確認するまで未完了のまま保持します。

- [x] Production URLがHTTP 200で表示される
- [x] Title、description、manifest、faviconが正しい
- [x] Console error、page error、404 asset、hydration errorがない
- [x] 顧客マスタDemoでProfile → Detect → Rule → Preview → Dry Run → Clean → Validate → Exportを完走する
- [x] 商品マスタDemoへ切替え、価格・商品コード・日付・重複を確認する
- [x] 売上データDemoへ切替え、日付・全角コード・金額・担当者・重複を確認する
- [x] 実fixtureのCSVを読み込み、Profilingを確認する（Rule / ExportはLocal QAで確認）
- [ ] 複数Sheet XLSXを読み込み、Sheet切替とXLSX Exportを確認する
- [ ] Rule無効化 / 削除、再Dry Run、Undo相当の再実行を確認する
- [ ] Templateの保存、再読込、削除、列互換性を確認する
- [ ] Cleaned CSV、Cleaned XLSX、Cleaning Reportを実際に生成する
- [ ] DesktopとMobileで主要Workflowを確認する
- [x] Productionから指定のScreenshot 5枚を取得する

### Local-first Network Check

Browser DevToolsまたは自動BrowserのNetwork logで、Demo以外のテスト用fixtureを使って確認します。

- [x] File選択時に入力File byte / Row / Cell値を含むrequestが送信されない
- [x] Profiling、Rule変更、Preview、Dry Run、Clean、Validateで業務データを送信しない
- [ ] Export生成時に業務データを外部へ送信しない
- [x] URL、query、fragment、console logへ業務データを露出しない
- [x] Appが必要とする通信は静的asset / Next.js配信に限定される

## Production Screenshot Checklist

5枚ともVercel Productionの実画面から、同じDesktop viewport（推奨1440 × 1000以上）で取得します。実在の個人情報は使わず、顧客マスタDemoを基本fixtureにしてください。Font、Profile、Preview、集計の完了を待ってから撮影します。

| # | File | 必須内容 | Status |
| ---: | --- | --- | --- |
| 1 | `docs/screenshots/01-data-profiling.png` | Data Profiling、行・列・空欄・重複、列別型・unique値 | PASS |
| 2 | `docs/screenshots/02-rule-settings.png` | 電話、登録日、メール等の列別RuleとTemplate | PASS |
| 3 | `docs/screenshots/03-before-after-preview.png` | Before / Afterと変更Cell Highlight | PASS |
| 4 | `docs/screenshots/04-dry-run-result.png` | 変更予定Cell、削除予定重複、警告のDry Run集計 | PASS |
| 5 | `docs/screenshots/05-dashboard-export.png` | 完了Dashboard、Validation、CSV / XLSX / Report Export | PASS |

撮影後の確認:

- [x] 画像がPNGで開ける
- [x] Browserのerror overlay、DevTools、個人情報、local URLが写っていない
- [x] 数字やラベルが途中で切れていない
- [x] 5枚が別々のWorkflow stateを示している
- [x] README / ポートフォリオから参照するpathと一致する
- [x] AI生成画像ではなくProduction実画面である

## Accessibility Manual Checks

Local環境でのaxe自動監査はviolations 0でした。これは下記のKeyboard、Screen Reader、Zoom、手動Contrast確認やWCAG適合認証を代替しません。

- [ ] Tab / Shift+Tabの順序が視覚順と一致する
- [ ] Enter / SpaceでButton、Demo、Rule switchを操作できる
- [ ] File input、Sheet select、Rule select、Template inputに明示Labelがある
- [ ] TableにHeader / captionまたは同等のaccessible nameがある
- [ ] Loading、Import error、Dry Run更新、Clean完了が支援技術へ通知される
- [ ] Before / Afterと警告が色だけでなくTextで区別できる
- [ ] NVDAまたはVoiceOverで主要Workflowの読み上げ順を確認する
- [ ] 200% zoomとtext spacing変更でも操作不能にならない
- [ ] Light背景上のText、Button、focus ringのcontrastを確認する

## Secret Scan / GitHub Publication

- [x] `.env*`（`.env.example`を除く）、`.vercel/`、`.npmrc`、log、coverage、private keyが`.gitignore`対象
- [x] `git ls-files`に`.env.local`、`.vercel/project.json`、token、credential、実業務dataがない
- [x] tracked filesをAPI key、token、password、private key patternでscanする
- [x] Git履歴全体をSecret Scannerでscanする
- [x] Scan command、scanner version、対象commit、結果を記録する
- [x] README、`package.json`、QA、Production、Screenshotの機能説明が一致する
- [x] GitHub RepositoryがPublicで、default branchが`main`、不要な履歴や個人情報がない
- [x] 3文書へProduction URLとGitHub公開URLを記載し、URL placeholderが残っていない

Secret Scan evidence:

```text
Scanner / version: Gitleaks 8.30.1
Command: gitleaks git . --no-banner --redact=100 --no-color --verbose
Commit: main HEADを含む公開前全Git履歴
Findings: 0
Disposition: PASS — no leaks found
```

## Sign-off

| Role | Name | Date | Result |
| --- | --- | --- | --- |
| Implementation | Codex | 2026-08-24 | PASS |
| Automated QA | `npm run verify` | 2026-08-24 | PASS — 47 tests / lint / typecheck / build |
| Production browser QA | Vercel Production / agent-browser | 2026-08-24 | PASS — 実施済みChecklist範囲 |
| Security / publication check | Gitleaks / GitHub CLI | 2026-08-24 | PASS — 0 findings / Public main |
