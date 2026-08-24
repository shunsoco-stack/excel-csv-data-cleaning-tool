import {
  ROW_ID_KEY,
  type CellValue,
  type CleaningConfig,
  type DataRow,
  type DataSet,
} from "./types";

export type DemoId = "customer-master" | "product-master" | "sales-data";

export interface DemoDefinition {
  id: DemoId;
  name: "顧客マスタ" | "商品マスタ" | "売上データ";
  description: string;
  dirtyFeatures: string[];
  dataSet: DataSet;
  config: CleaningConfig;
}

type DemoInputRow = Record<string, CellValue | undefined>;

function createDemoDataSet(
  id: DemoId,
  name: DemoDefinition["name"],
  headers: string[],
  inputRows: readonly DemoInputRow[],
): DataSet {
  const rows = inputRows.map((input, rowIndex) => {
    const row = { [ROW_ID_KEY]: `demo-${id}-row-${rowIndex + 1}` } as DataRow;
    headers.forEach((header) => {
      row[header] = input[header] ?? null;
    });
    return row;
  });
  return {
    id: `demo-${id}`,
    name,
    headers: [...headers],
    rows,
    metadata: {
      source: {
        fileName: `${id}.csv`,
        fileType: "csv",
        fileSize: 0,
        rowCount: rows.length,
        columnCount: headers.length,
        sheetNames: [],
        encoding: "utf-8",
        delimiter: ",",
      },
    },
  };
}

export const CUSTOMER_MASTER_CLEANING_CONFIG: CleaningConfig = {
  rules: [
    { id: "customer-name-trim", column: "氏名", kind: "trim" },
    { id: "customer-name-spaces", column: "氏名", kind: "collapse-spaces" },
    { id: "customer-phone-width", column: "電話番号", kind: "full-width-to-half" },
    { id: "customer-phone-format", column: "電話番号", kind: "phone" },
    { id: "customer-postal-width", column: "郵便番号", kind: "full-width-to-half" },
    { id: "customer-postal-format", column: "郵便番号", kind: "postal-code" },
    { id: "customer-email-trim", column: "メール", kind: "trim" },
    { id: "customer-email-lower", column: "メール", kind: "lowercase" },
    { id: "customer-date", column: "登録日", kind: "date-yyyy-mm-dd" },
    { id: "customer-note-empty", column: "備考", kind: "empty-to-null" },
  ],
  duplicateRule: {
    id: "customer-duplicates",
    columns: ["顧客ID"],
    keep: "first",
  },
};

export const PRODUCT_MASTER_CLEANING_CONFIG: CleaningConfig = {
  rules: [
    { id: "product-code-width", column: "商品コード", kind: "full-width-to-half" },
    { id: "product-name-trim", column: "商品名", kind: "trim" },
    { id: "product-name-spaces", column: "商品名", kind: "collapse-spaces" },
    { id: "product-category-trim", column: "カテゴリ", kind: "trim" },
    { id: "product-price-width", column: "価格", kind: "full-width-to-half" },
    { id: "product-price", column: "価格", kind: "remove-number-commas" },
    { id: "product-date", column: "登録日", kind: "date-yyyy-mm-dd" },
    { id: "product-note-empty", column: "備考", kind: "empty-to-null" },
  ],
  duplicateRule: {
    id: "product-duplicates",
    columns: ["商品コード"],
    keep: "first",
  },
};

export const SALES_DATA_CLEANING_CONFIG: CleaningConfig = {
  rules: [
    { id: "sales-date", column: "取引日", kind: "date-yyyy-mm-dd" },
    { id: "sales-store-width", column: "店舗コード", kind: "full-width-to-half" },
    { id: "sales-product-width", column: "商品コード", kind: "full-width-to-half" },
    { id: "sales-amount-width", column: "売上金額", kind: "full-width-to-half" },
    { id: "sales-amount", column: "売上金額", kind: "remove-number-commas" },
    { id: "sales-staff-trim", column: "担当者", kind: "trim" },
    { id: "sales-staff-spaces", column: "担当者", kind: "collapse-spaces" },
    { id: "sales-note-empty", column: "備考", kind: "empty-to-null" },
  ],
  duplicateRule: {
    id: "sales-duplicates",
    columns: ["売上ID"],
    keep: "first",
  },
};

export const CUSTOMER_MASTER_DEMO: DemoDefinition = {
  id: "customer-master",
  name: "顧客マスタ",
  description: "顧客名、連絡先、登録日の表記ゆれと重複を含む架空の顧客データです。",
  dirtyFeatures: [
    "前後・連続空白",
    "全角の電話番号・郵便番号",
    "メールの大文字小文字",
    "複数の日付形式",
    "空欄・不正値",
    "顧客ID重複・完全重複行",
  ],
  dataSet: createDemoDataSet(
    "customer-master",
    "顧客マスタ",
    ["顧客ID", "氏名", "電話番号", "郵便番号", "メール", "登録日", "都道府県", "備考"],
    [
      {
        顧客ID: "C001",
        氏名: "　山田　　太郎 ",
        電話番号: "０９０－１２３４－５６７８",
        郵便番号: "１０００００１",
        メール: " TARO.YAMADA@EXAMPLE.INVALID ",
        登録日: "2026/8/1",
        都道府県: "東京都",
        備考: "",
      },
      {
        顧客ID: "C002",
        氏名: "佐藤 花子",
        電話番号: "03 (1234) 5678",
        郵便番号: "150-0001",
        メール: "HANAKO.SATO@example.invalid",
        登録日: "20260802",
        都道府県: "東京都",
        備考: "優先顧客",
      },
      {
        顧客ID: "C002",
        氏名: " 佐藤   花子 ",
        電話番号: "０３１２３４５６７８",
        郵便番号: "１５００００１",
        メール: "hanako.sato@EXAMPLE.INVALID",
        登録日: "2026年8月2日",
        都道府県: "東京都",
        備考: "重複登録",
      },
      {
        顧客ID: "C003",
        氏名: "鈴木　一郎",
        電話番号: null,
        郵便番号: "5300001",
        メール: "",
        登録日: "2026-02-30",
        都道府県: "大阪府",
        備考: "日付確認",
      },
      {
        顧客ID: "C004",
        氏名: "高橋 美咲",
        電話番号: "080-2222-3333",
        郵便番号: "460-0001",
        メール: "misaki.takahashi@example.invalid",
        登録日: "2026-08-04",
        都道府県: "愛知県",
        備考: null,
      },
      {
        顧客ID: "C004",
        氏名: "高橋 美咲",
        電話番号: "080-2222-3333",
        郵便番号: "460-0001",
        メール: "misaki.takahashi@example.invalid",
        登録日: "2026-08-04",
        都道府県: "愛知県",
        備考: null,
      },
      {
        顧客ID: "C005",
        氏名: " 伊藤   健 ",
        電話番号: "0120-12-3456",
        郵便番号: "12-345",
        メール: "KEN.ITO@EXAMPLE.INVALID",
        登録日: "2026/08/05",
        都道府県: "福岡県",
        備考: "郵便番号要確認",
      },
    ],
  ),
  config: CUSTOMER_MASTER_CLEANING_CONFIG,
};

export const PRODUCT_MASTER_DEMO: DemoDefinition = {
  id: "product-master",
  name: "商品マスタ",
  description: "EC商品名、商品コード、価格、登録日の表記ゆれを含む架空の商品データです。",
  dirtyFeatures: [
    "全角の商品コード",
    "商品名・カテゴリの空白",
    "カンマ付き価格",
    "複数の日付形式",
    "空欄",
    "商品コード重複",
  ],
  dataSet: createDemoDataSet(
    "product-master",
    "商品マスタ",
    ["商品コード", "商品名", "カテゴリ", "価格", "在庫数", "登録日", "公開状態", "備考"],
    [
      {
        商品コード: "Ｐ－１００１",
        商品名: "  オーガニック　コーヒー  ",
        カテゴリ: " 飲料 ",
        価格: "1,280",
        在庫数: 24,
        登録日: "2026/7/15",
        公開状態: "公開",
        備考: "",
      },
      {
        商品コード: "P-1002",
        商品名: "国産   はちみつ",
        カテゴリ: "食品",
        価格: "２，４８０",
        在庫数: 8,
        登録日: "20260716",
        公開状態: "公開",
        備考: null,
      },
      {
        商品コード: "P-1002",
        商品名: " 国産 はちみつ ",
        カテゴリ: "食品 ",
        価格: "2,480",
        在庫数: 7,
        登録日: "2026年7月16日",
        公開状態: "公開",
        備考: "重複登録",
      },
      {
        商品コード: "Ｐ－１００３",
        商品名: "瀬戸内レモン　ジャム",
        カテゴリ: " 食品",
        価格: "980",
        在庫数: null,
        登録日: "2026-07-18",
        公開状態: "下書き",
        備考: "在庫確認",
      },
      {
        商品コード: "P-1004",
        商品名: " 竹製   タンブラー ",
        カテゴリ: "生活雑貨",
        価格: "3,200",
        在庫数: 15,
        登録日: "2026/13/01",
        公開状態: "公開",
        備考: "日付要確認",
      },
    ],
  ),
  config: PRODUCT_MASTER_CLEANING_CONFIG,
};

export const SALES_DATA_DEMO: DemoDefinition = {
  id: "sales-data",
  name: "売上データ",
  description: "取引日、店舗・商品コード、金額、担当者名の表記ゆれを含む架空の売上データです。",
  dirtyFeatures: [
    "複数の日付形式",
    "全角コード",
    "カンマ付き売上金額",
    "担当者名の空白",
    "欠損値",
    "売上ID重複・完全重複行",
  ],
  dataSet: createDemoDataSet(
    "sales-data",
    "売上データ",
    ["売上ID", "取引日", "店舗コード", "商品コード", "数量", "売上金額", "担当者", "備考"],
    [
      {
        売上ID: "S0001",
        取引日: "2026/08/01",
        店舗コード: "ＴＫＹ－０１",
        商品コード: "Ｐ－１００１",
        数量: 2,
        売上金額: "2,560",
        担当者: " 山田　　葵 ",
        備考: "",
      },
      {
        売上ID: "S0002",
        取引日: "20260801",
        店舗コード: "OSK-01",
        商品コード: "P-1002",
        数量: 1,
        売上金額: "２，４８０",
        担当者: "佐々木 健",
        備考: null,
      },
      {
        売上ID: "S0003",
        取引日: "2026年8月2日",
        店舗コード: "ＮＧＹ－０１",
        商品コード: "P-1003",
        数量: null,
        売上金額: "980",
        担当者: "鈴木　美穂",
        備考: "数量未入力",
      },
      {
        売上ID: "S0004",
        取引日: "2026-08-03",
        店舗コード: "TKY-01",
        商品コード: "P-1004",
        数量: 1,
        売上金額: "3,200",
        担当者: " 田中   誠 ",
        備考: "店頭販売",
      },
      {
        売上ID: "S0004",
        取引日: "2026-08-03",
        店舗コード: "TKY-01",
        商品コード: "P-1004",
        数量: 1,
        売上金額: "3,200",
        担当者: " 田中   誠 ",
        備考: "店頭販売",
      },
      {
        売上ID: "S0005",
        取引日: "2026/02/30",
        店舗コード: "FUK-01",
        商品コード: "P-1001",
        数量: 3,
        売上金額: "7,680",
        担当者: "中村 玲",
        備考: "日付確認",
      },
    ],
  ),
  config: SALES_DATA_CLEANING_CONFIG,
};

export const DEMO_DEFINITIONS: readonly DemoDefinition[] = [
  CUSTOMER_MASTER_DEMO,
  PRODUCT_MASTER_DEMO,
  SALES_DATA_DEMO,
];

/** UI-ready entries: source data and a populated recommended config travel together. */
export const DEMO_DATASETS: readonly DemoDefinition[] = DEMO_DEFINITIONS;

export const DEMO_SOURCE_DATASETS: readonly DataSet[] = DEMO_DEFINITIONS.map(
  (demo) => demo.dataSet,
);

export function getDemoDefinition(id: DemoId): DemoDefinition {
  const demo = DEMO_DEFINITIONS.find((candidate) => candidate.id === id);
  if (!demo) throw new Error(`Demo not found: ${id}`);
  return demo;
}

/** Return a detached copy so Demo re-runs always start from pristine source data. */
export function loadDemo(id: DemoId): DemoDefinition {
  return structuredClone(getDemoDefinition(id));
}
