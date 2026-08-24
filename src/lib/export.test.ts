import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";

import {
  CLEANING_REPORT_SHEET_NAMES,
  createCleanedCsv,
  createCleanedXlsx,
  createCleaningReportCsv,
  createCleaningReportXlsx,
  protectSpreadsheetCell,
  sanitizeWorksheetName,
} from "./export";
import {
  ROW_ID_KEY,
  type CleaningConfig,
  type CleaningResult,
  type DataRow,
  type DataSet,
} from "./types";

const originalRows: DataRow[] = [
  {
    [ROW_ID_KEY]: "row-1",
    顧客ID: "C001",
    氏名: " =WEBSERVICE(\"https://example.invalid\")",
    電話番号: "０９０１２３４５６７８",
    備考: "",
  },
  {
    [ROW_ID_KEY]: "row-2",
    顧客ID: "C001",
    氏名: "重複",
    電話番号: "09012345678",
    備考: null,
  },
];

const originalDataSet: DataSet = {
  id: "customers",
  name: "顧客/一覧:*?[]",
  headers: ["顧客ID", "氏名", "電話番号", "備考"],
  rows: originalRows,
  metadata: {
    source: {
      fileName: "customers.csv",
      fileType: "csv",
      fileSize: 100,
      rowCount: 2,
      columnCount: 4,
      sheetNames: [],
      encoding: "utf-8",
      delimiter: ",",
    },
  },
};

const cleanedDataSet: DataSet = {
  ...originalDataSet,
  id: "customers-cleaned",
  name: "Cleaned Data",
  rows: [
    {
      ...originalRows[0],
      電話番号: "090-1234-5678",
      備考: null,
    },
  ],
};

const result: CleaningResult = {
  originalDataSet,
  cleanedDataSet,
  changes: [
    {
      rowId: "row-1",
      rowIndex: 0,
      column: "電話番号",
      columnIndex: 2,
      before: "０９０１２３４５６７８",
      after: "090-1234-5678",
      ruleIds: ["phone-width", "phone-format"],
    },
    {
      rowId: "row-1",
      rowIndex: 0,
      column: "備考",
      columnIndex: 3,
      before: "",
      after: null,
      ruleIds: ["empty"],
    },
  ],
  warnings: [
    {
      code: "invalid-date",
      message: "日付を解釈できないため元の値を保持しました。",
      ruleId: "date",
      rowId: "row-1",
      rowIndex: 0,
      column: "登録日",
      columnIndex: 4,
      value: "2026-02-30",
    },
  ],
  removedDuplicates: [
    {
      rowId: "row-2",
      rowIndex: 1,
      duplicateOfRowId: "row-1",
      duplicateOfRowIndex: 0,
      keyColumns: ["顧客ID"],
      keyValues: ["C001"],
    },
  ],
  summary: {
    sourceRowCount: 2,
    outputRowCount: 1,
    sourceEmptyCount: 2,
    outputEmptyCount: 1,
    changedCellCount: 2,
    removedDuplicateCount: 1,
    warningCount: 1,
    appliedRuleCount: 4,
  },
};

const config: CleaningConfig = {
  rules: [
    { id: "phone-width", column: "電話番号", kind: "full-width-to-half" },
    { id: "phone-format", column: "電話番号", kind: "phone" },
    { id: "empty", column: "備考", kind: "empty-to-null" },
    { id: "date", column: "登録日", kind: "date-yyyy-mm-dd" },
  ],
  duplicateRule: { id: "duplicates", columns: ["顧客ID"], keep: "first" },
};

describe("cleaned data export", () => {
  it("creates BOM UTF-8 CSV, protects formula-like cells, and omits internal row IDs", () => {
    const bytes = createCleanedCsv(cleanedDataSet);
    const text = new TextDecoder().decode(bytes);

    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(text).toContain("' =WEBSERVICE");
    expect(text).toContain("090-1234-5678");
    expect(text).not.toContain(ROW_ID_KEY);
  });

  it("creates a safe XLSX that round-trips typed cells and export headers", () => {
    const bytes = createCleanedXlsx(cleanedDataSet, { sheetName: "顧客/一覧:*?[]" });
    const workbook = XLSX.read(bytes, { type: "array" });
    expect(workbook.SheetNames).toEqual(["顧客_一覧_____"]);

    const matrix = XLSX.utils.sheet_to_json<unknown[]>(
      workbook.Sheets[workbook.SheetNames[0]],
      { header: 1, raw: true, defval: null },
    );
    expect(matrix[0]).toEqual(cleanedDataSet.headers);
    expect(matrix[1][1]).toBe("' =WEBSERVICE(\"https://example.invalid\")");
    expect(matrix.flat()).not.toContain(ROW_ID_KEY);
  });

  it("uses strict spreadsheet formula protection and valid worksheet names", () => {
    expect(protectSpreadsheetCell("\t+1+1")).toBe("'\t+1+1");
    expect(protectSpreadsheetCell("normal")).toBe("normal");
    expect(protectSpreadsheetCell(123)).toBe(123);
    expect(sanitizeWorksheetName("[]:*?/\\")).toBe("_______");
    expect(sanitizeWorksheetName("'".repeat(40))).toBe("Cleaned Data");
  });
});

describe("cleaning report export", () => {
  const source = {
    result,
    config,
    generatedAt: new Date("2026-08-24T01:02:03.000Z"),
  };

  it("creates an audit workbook with summary, cleaned values and details", () => {
    const bytes = createCleaningReportXlsx(source);
    const workbook = XLSX.read(bytes, { type: "array" });
    expect(workbook.SheetNames).toEqual([...CLEANING_REPORT_SHEET_NAMES]);

    const summary = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets.Summary, {
      header: 1,
      raw: true,
      defval: null,
    });
    expect(summary).toContainEqual(["修正セル数", 2]);
    expect(summary).toContainEqual(["削除重複数", 1]);
    expect(summary).toContainEqual(["警告件数", 1]);
    expect(summary).toContainEqual(["レポート生成日時", "2026-08-24T01:02:03.000Z"]);

    const changes = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets.Changes, {
      header: 1,
      raw: true,
      defval: null,
    });
    expect(changes[1]).toEqual([
      2,
      "電話番号",
      "０９０１２３４５６７８",
      "090-1234-5678",
      "phone-width, phone-format",
    ]);

    const removed = XLSX.utils.sheet_to_json<unknown[]>(
      workbook.Sheets["Removed Duplicates"],
      { header: 1, raw: true, defval: null },
    );
    expect(removed[1].slice(0, 4)).toEqual([3, 2, "顧客ID", "C001"]);
  });

  it("creates a long-form CSV containing changes, warnings and removed duplicates", () => {
    const text = new TextDecoder().decode(createCleaningReportCsv(source));
    expect(text).toContain("変更セル");
    expect(text).toContain("警告");
    expect(text).toContain("invalid-date");
    expect(text).toContain("削除重複");
    expect(text).toContain("顧客ID");
  });
});
