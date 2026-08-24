import * as XLSX from "xlsx";

import {
  ROW_ID_KEY,
  type CellRuleKind,
  type CellValue,
  type CleaningConfig,
  type CleaningResult,
  type DataRow,
  type DataSet,
} from "./types";

export const CLEANED_CSV_MIME_TYPE = "text/csv;charset=utf-8";
export const CLEANED_XLSX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export const CLEANED_CSV_FILENAME = "cleaned-data.csv";
export const CLEANED_XLSX_FILENAME = "cleaned-data.xlsx";
export const CLEANING_REPORT_XLSX_FILENAME = "cleaning-report.xlsx";
export const CLEANING_REPORT_CSV_FILENAME = "cleaning-report.csv";

export const CLEANING_REPORT_SHEET_NAMES = [
  "Summary",
  "Cleaned Data",
  "Changes",
  "Warnings",
  "Removed Duplicates",
  "Rules",
] as const;

export interface CsvExportOptions {
  /** Excel-friendly UTF-8 BOM is enabled by default. */
  bom?: boolean;
  lineEnding?: "\r\n" | "\n";
}

export interface XlsxExportOptions {
  sheetName?: string;
}

export interface CleaningReportSource {
  result: CleaningResult;
  config?: CleaningConfig;
  /** Optional for deterministic tests; defaults to the current time. */
  generatedAt?: Date | string;
}

type ReportCell = CellValue | undefined;
type ReportRow = readonly ReportCell[];

const FORMULA_LIKE_TEXT = /^[\u0000-\u0020\uFEFF\p{White_Space}]*[=+\-@]/u;

const RULE_LABELS: Readonly<Record<CellRuleKind, string>> = {
  trim: "前後空白削除",
  "collapse-spaces": "連続空白整理",
  "full-width-to-half": "全角→半角",
  "half-width-to-full": "半角→全角",
  lowercase: "小文字統一",
  uppercase: "大文字統一",
  phone: "電話番号整形",
  "postal-code": "郵便番号整形",
  "date-yyyy-mm-dd": "日付をYYYY-MM-DDへ統一",
  "remove-number-commas": "数値カンマ除去",
  "empty-to-null": "空文字をnullへ統一",
};

/**
 * Prefix formula-like strings before they cross a spreadsheet boundary.
 * Numbers and booleans remain typed; null remains an empty cell.
 */
export function protectSpreadsheetCell(value: ReportCell): CellValue {
  if (value === undefined || value === null) return null;
  if (typeof value === "string" && FORMULA_LIKE_TEXT.test(value)) {
    return `'${value}`;
  }
  return value;
}

function displayCell(value: ReportCell): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

function exportRows(dataSet: DataSet): ReportRow[] {
  return [
    [...dataSet.headers],
    ...dataSet.rows.map((row) => dataSet.headers.map((header) => row[header] ?? null)),
  ];
}

function createWorksheet(rows: readonly ReportRow[]): XLSX.WorkSheet {
  const safeRows = rows.map((row) => row.map(protectSpreadsheetCell));
  const worksheet = XLSX.utils.aoa_to_sheet(safeRows);
  const columnCount = safeRows.reduce(
    (maximum, row) => Math.max(maximum, row.length),
    0,
  );

  worksheet["!cols"] = Array.from({ length: columnCount }, (_, columnIndex) => {
    const width = safeRows.reduce((maximum, row) => {
      const value = row[columnIndex];
      return Math.max(maximum, displayCell(value).length);
    }, 0);
    return { wch: Math.min(Math.max(width + 2, 10), 48) };
  });

  if (safeRows.length > 0 && columnCount > 0) {
    worksheet["!autofilter"] = {
      ref: XLSX.utils.encode_range({
        s: { r: 0, c: 0 },
        e: { r: Math.max(safeRows.length - 1, 0), c: columnCount - 1 },
      }),
    };
  }

  return worksheet;
}

function writeWorkbook(workbook: XLSX.WorkBook): Uint8Array {
  const binary = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array",
    compression: true,
  }) as ArrayBuffer | Uint8Array;
  return binary instanceof Uint8Array ? binary : new Uint8Array(binary);
}

export function sanitizeWorksheetName(value: string, fallback = "Cleaned Data"): string {
  const normalized = value
    .replace(/[\\/*?:[\]]/gu, "_")
    .replace(/^'+|'+$/gu, "")
    .trim()
    .slice(0, 31);
  return normalized || fallback;
}

function csvField(value: ReportCell): string {
  const text = displayCell(protectSpreadsheetCell(value));
  return `"${text.replaceAll('"', '""')}"`;
}

function rowsToCsv(
  rows: readonly ReportRow[],
  options: CsvExportOptions = {},
): Uint8Array {
  const lineEnding = options.lineEnding ?? "\r\n";
  const text = rows.map((row) => row.map(csvField).join(",")).join(lineEnding);
  const prefix = (options.bom ?? true) ? "\uFEFF" : "";
  return new TextEncoder().encode(`${prefix}${text}`);
}

/** Create a browser-safe UTF-8 CSV from the cleaned dataset. */
export function createCleanedCsv(
  dataSet: DataSet,
  options: CsvExportOptions = {},
): Uint8Array {
  return rowsToCsv(exportRows(dataSet), options);
}

/** Create a one-sheet XLSX containing only export headers and cleaned values. */
export function createCleanedXlsx(
  dataSet: DataSet,
  options: XlsxExportOptions = {},
): Uint8Array {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    createWorksheet(exportRows(dataSet)),
    sanitizeWorksheetName(options.sheetName ?? dataSet.name),
  );
  return writeWorkbook(workbook);
}

function generatedAtText(source: CleaningReportSource): string {
  const date = source.generatedAt instanceof Date
    ? source.generatedAt
    : source.generatedAt
      ? new Date(source.generatedAt)
      : new Date();
  return Number.isNaN(date.getTime()) ? String(source.generatedAt ?? "") : date.toISOString();
}

function summaryRows(source: CleaningReportSource): ReportRow[] {
  const { originalDataSet, cleanedDataSet, summary } = source.result;
  return [
    ["項目", "値"],
    ["レポート生成日時", generatedAtText(source)],
    ["元ファイル", originalDataSet.metadata?.source?.fileName ?? originalDataSet.name],
    ["対象シート", originalDataSet.metadata?.source?.activeSheet ?? originalDataSet.name],
    ["元データ行数", summary.sourceRowCount],
    ["出力行数", summary.outputRowCount],
    ["元データ空欄数", summary.sourceEmptyCount],
    ["出力空欄数", summary.outputEmptyCount],
    ["修正セル数", summary.changedCellCount],
    ["削除重複数", summary.removedDuplicateCount],
    ["警告件数", summary.warningCount],
    ["適用ルール数", summary.appliedRuleCount],
    ["出力列数", cleanedDataSet.headers.length],
  ];
}

function changeRows(source: CleaningReportSource): ReportRow[] {
  return [
    ["元データ行", "列", "Before", "After", "適用ルールID"],
    ...source.result.changes.map((change): ReportRow => [
      change.rowIndex + 2,
      change.column,
      change.before,
      change.after,
      change.ruleIds.join(", "),
    ]),
  ];
}

function warningRows(source: CleaningReportSource): ReportRow[] {
  return [
    ["コード", "メッセージ", "元データ行", "列", "値", "ルールID"],
    ...source.result.warnings.map((warning): ReportRow => [
      warning.code,
      warning.message,
      warning.rowIndex === undefined ? null : warning.rowIndex + 2,
      warning.column ?? null,
      warning.value ?? null,
      warning.ruleId ?? null,
    ]),
  ];
}

function resolveOriginalRow(
  dataSet: DataSet,
  rowIndex: number,
  rowId: string,
): DataRow | undefined {
  const indexed = dataSet.rows[rowIndex];
  if (indexed?.[ROW_ID_KEY] === rowId) return indexed;
  return dataSet.rows.find((row) => row[ROW_ID_KEY] === rowId);
}

function removedDuplicateRows(source: CleaningReportSource): ReportRow[] {
  const dataSet = source.result.originalDataSet;
  return [
    [
      "削除行",
      "重複元行",
      "判定列",
      "判定値",
      ...dataSet.headers,
    ],
    ...source.result.removedDuplicates.map((duplicate): ReportRow => {
      const row = resolveOriginalRow(dataSet, duplicate.rowIndex, duplicate.rowId);
      return [
        duplicate.rowIndex + 2,
        duplicate.duplicateOfRowIndex + 2,
        duplicate.keyColumns.join(", "),
        duplicate.keyValues.map(displayCell).join(" | "),
        ...dataSet.headers.map((header) => row?.[header] ?? null),
      ];
    }),
  ];
}

function ruleRows(source: CleaningReportSource): ReportRow[] {
  const config = source.config;
  const rows: ReportRow[] = [["順序", "対象列", "ルール", "ルールID", "状態"]];
  if (!config) {
    rows.push([null, null, "設定情報なし", null, null]);
    return rows;
  }

  config.rules.forEach((rule, index) => {
    rows.push([
      index + 1,
      rule.column,
      RULE_LABELS[rule.kind],
      rule.id,
      rule.enabled === false ? "無効" : "有効",
    ]);
  });

  if (config.duplicateRule) {
    rows.push([
      config.rules.length + 1,
      config.duplicateRule.columns?.join(", ") || "全列",
      `重複削除（${config.duplicateRule.keep === "last" ? "最後を保持" : "最初を保持"}）`,
      config.duplicateRule.id ?? "remove-duplicates",
      config.duplicateRule.enabled === false ? "無効" : "有効",
    ]);
  }
  return rows;
}

/**
 * Create an audit-friendly workbook. Input bytes and source data never leave
 * the browser; the caller explicitly downloads the returned bytes.
 */
export function createCleaningReportXlsx(source: CleaningReportSource): Uint8Array {
  const workbook = XLSX.utils.book_new();
  const sheets: ReadonlyArray<readonly [string, readonly ReportRow[]]> = [
    ["Summary", summaryRows(source)],
    ["Cleaned Data", exportRows(source.result.cleanedDataSet)],
    ["Changes", changeRows(source)],
    ["Warnings", warningRows(source)],
    ["Removed Duplicates", removedDuplicateRows(source)],
    ["Rules", ruleRows(source)],
  ];

  for (const [name, rows] of sheets) {
    XLSX.utils.book_append_sheet(workbook, createWorksheet(rows), name);
  }
  return writeWorkbook(workbook);
}

/** Create a long-form UTF-8 CSV cleaning report for lightweight sharing. */
export function createCleaningReportCsv(
  source: CleaningReportSource,
  options: CsvExportOptions = {},
): Uint8Array {
  const rows: ReportRow[] = [[
    "種別",
    "元データ行",
    "列",
    "Before / 値",
    "After",
    "コード / 判定列",
    "メッセージ / 重複元行",
  ]];

  source.result.changes.forEach((change) => {
    rows.push([
      "変更セル",
      change.rowIndex + 2,
      change.column,
      change.before,
      change.after,
      change.ruleIds.join(", "),
      null,
    ]);
  });
  source.result.warnings.forEach((warning) => {
    rows.push([
      "警告",
      warning.rowIndex === undefined ? null : warning.rowIndex + 2,
      warning.column ?? null,
      warning.value ?? null,
      null,
      warning.code,
      warning.message,
    ]);
  });
  source.result.removedDuplicates.forEach((duplicate) => {
    rows.push([
      "削除重複",
      duplicate.rowIndex + 2,
      null,
      duplicate.keyValues.map(displayCell).join(" | "),
      null,
      duplicate.keyColumns.join(", "),
      duplicate.duplicateOfRowIndex + 2,
    ]);
  });

  return rowsToCsv(rows, options);
}
