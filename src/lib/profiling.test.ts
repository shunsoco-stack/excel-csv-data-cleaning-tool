import { describe, expect, it } from "vitest";
import { profileData } from "./profiling";
import {
  ROW_ID_KEY,
  type CellValue,
  type DataRow,
  type DataSet,
} from "./types";

function row(id: string, values: Record<string, CellValue>): DataRow {
  return { [ROW_ID_KEY]: id, ...values } as DataRow;
}

function dataSet(headers: string[], rows: DataRow[]): DataSet {
  return { id: "profile", name: "プロファイルfixture", headers, rows };
}

describe("profileData", () => {
  it("calculates rows, columns, blanks, raw duplicates, unique values and types", () => {
    const source = dataSet(
      ["ID", "登録日", "金額", "有効", "空欄"],
      [
        row("r1", {
          ID: "001",
          登録日: "2026/8/9",
          金額: "1,200",
          有効: true,
          空欄: "",
        }),
        row("r2", {
          ID: "002",
          登録日: "2026-08-10",
          金額: 2000,
          有効: false,
          空欄: null,
        }),
        row("r3", {
          ID: "002",
          登録日: "2026-08-10",
          金額: 2000,
          有効: false,
          空欄: null,
        }),
      ],
    );
    const snapshot = JSON.parse(JSON.stringify(source)) as DataSet;
    const profile = profileData(source);

    expect(profile).toMatchObject({
      rowCount: 3,
      columnCount: 5,
      emptyCount: 3,
      duplicateCount: 1,
      uniqueRowCount: 2,
    });
    expect(Object.fromEntries(profile.columns.map((column) => [
      column.column,
      column.inferredType,
    ]))).toEqual({
      ID: "string",
      登録日: "date",
      金額: "number",
      有効: "boolean",
      空欄: "empty",
    });
    expect(Object.fromEntries(profile.columns.map((column) => [
      column.column,
      column.uniqueCount,
    ]))).toEqual({ ID: 2, 登録日: 2, 金額: 2, 有効: 2, 空欄: 0 });
    expect(profile.columns.find((column) => column.column === "空欄")).toMatchObject({
      emptyCount: 3,
      nonEmptyCount: 0,
      duplicateValueCount: 0,
      typeConfidence: 0,
    });
    expect(profile.issueSummary).toMatchObject({
      "missing-value": 3,
      "date-format": 1,
      "numeric-comma": 1,
      "duplicate-row": 1,
    });
    expect(profile.issues.find((issue) => issue.kind === "duplicate-row")).toMatchObject({
      rowId: "r3",
      rowIndex: 2,
      suggestedRule: "remove-duplicates",
    });
    expect(source).toEqual(snapshot);
  });

  it("detects actionable whitespace, width, case and structured-format issues", () => {
    const source = dataSet(
      ["氏名", "メール", "電話番号", "郵便番号", "登録日", "商品コード"],
      [row("dirty", {
        氏名: "　山田   太郎　",
        メール: "USER@Example.COM",
        電話番号: "０９０（１２３４）５６７８",
        郵便番号: "〒１５００００１",
        登録日: "2026-02-30",
        商品コード: "ｶﾞ-001",
      })],
    );
    const profile = profileData(source);

    expect(profile.issueSummary).toMatchObject({
      "leading-trailing-space": 1,
      "repeated-space": 1,
      "mixed-case": 1,
      "phone-format": 1,
      "postal-code-format": 1,
      "invalid-date": 1,
      "half-width-kana": 1,
    });
    expect(profile.issues.find((issue) => issue.kind === "phone-format")).toMatchObject({
      rowId: "dirty",
      rowIndex: 0,
      column: "電話番号",
      columnIndex: 2,
      suggestedRule: "phone",
    });
    expect(profile.issues.find((issue) => issue.kind === "invalid-date")).toMatchObject({
      severity: "warning",
      value: "2026-02-30",
    });
  });

  it("uses semantic headers for phone, postal, email and date confidence", () => {
    const source = dataSet(
      ["電話", "ZIP", "email", "date", "code"],
      [
        row("r1", {
          電話: "090-1234-5678",
          ZIP: "150-0001",
          email: "one@example.com",
          date: "2026/8/9",
          code: "001",
        }),
        row("r2", {
          電話: "invalid",
          ZIP: "123456",
          email: "broken",
          date: "not-a-date",
          code: "002",
        }),
      ],
    );
    const profile = profileData(source);
    const columns = Object.fromEntries(profile.columns.map((column) => [column.column, column]));

    expect(columns.電話).toMatchObject({ inferredType: "phone", typeConfidence: 0.5 });
    expect(columns.ZIP).toMatchObject({ inferredType: "postal-code", typeConfidence: 0.5 });
    expect(columns.email).toMatchObject({ inferredType: "email", typeConfidence: 0.5 });
    expect(columns.date).toMatchObject({ inferredType: "date", typeConfidence: 0.5 });
    expect(columns.code.inferredType).toBe("string");
    expect(profile.issueSummary).toMatchObject({
      "invalid-phone": 1,
      "invalid-postal-code": 1,
      "invalid-date": 1,
    });
  });

  it("flags numeric spreadsheet dates and numeric phone cells without coercion", () => {
    const source = dataSet(["登録日", "電話番号"], [
      row("xlsx-row", { 登録日: 61, 電話番号: 90_1234_5678 }),
    ]);
    const profile = profileData(source);
    expect(profile.columns[0]).toMatchObject({ inferredType: "date", typeConfidence: 1 });
    expect(profile.issueSummary["date-format"]).toBe(1);
    expect(profile.issueSummary["invalid-phone"]).toBe(1);
    expect(profile.issues.find((issue) => issue.kind === "date-format")).toMatchObject({
      rowId: "xlsx-row",
      value: 61,
      suggestedRule: "date-yyyy-mm-dd",
    });
  });

  it("keeps typed values distinct in column and row uniqueness", () => {
    const source = dataSet(["value"], [
      row("number", { value: 1 }),
      row("string", { value: "1" }),
      row("number-copy", { value: 1 }),
    ]);
    const profile = profileData(source);
    expect(profile.columns[0]).toMatchObject({
      uniqueCount: 2,
      duplicateValueCount: 1,
    });
    expect(profile.duplicateCount).toBe(1);
    expect(profile.uniqueRowCount).toBe(2);
  });

  it("reports whitespace-only cells as missing without counting them as unique", () => {
    const source = dataSet(["memo"], [
      row("empty", { memo: "" }),
      row("spaces", { memo: " \t　" }),
      row("null", { memo: null }),
      row("value", { memo: "0" }),
    ]);
    const profile = profileData(source);
    expect(profile).toMatchObject({ emptyCount: 3 });
    expect(profile.columns[0]).toMatchObject({
      emptyCount: 3,
      nonEmptyCount: 1,
      uniqueCount: 1,
    });
    expect(profile.issueSummary["missing-value"]).toBe(3);
  });
});
