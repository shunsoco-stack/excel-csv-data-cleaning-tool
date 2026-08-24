import { describe, expect, it } from "vitest";
import {
  applyCleaning,
  collapseSpaces,
  evaluateCellRule,
  fullWidthToHalfWidth,
  halfWidthToFullWidth,
  parseDateValue,
  transformCell,
} from "./cleaning-engine";
import {
  ROW_ID_KEY,
  type CellValue,
  type CleaningConfig,
  type DataRow,
  type DataSet,
} from "./types";

function row(id: string, values: Record<string, CellValue>): DataRow {
  return { [ROW_ID_KEY]: id, ...values } as DataRow;
}

function dataSet(
  headers: string[],
  rows: DataRow[],
  id = "fixture",
): DataSet {
  return { id, name: "テストデータ", headers, rows };
}

describe("scalar cleaning rules", () => {
  it("trims Unicode edge whitespace and collapses only horizontal runs", () => {
    expect(transformCell("\t　 Alice \u00a0", "trim")).toBe("Alice");
    expect(collapseSpaces("山田\t　 太郎\n二行目")).toBe("山田 太郎\n二行目");
    expect(transformCell("山田   太郎", "collapse-spaces")).toBe("山田 太郎");
    expect(transformCell(0, "trim")).toBe(0);
    expect(transformCell(false, "collapse-spaces")).toBe(false);
    expect(transformCell(null, "trim")).toBeNull();
  });

  it("normalizes case without coercing non-string cells", () => {
    expect(transformCell("AbC@example.COM", "lowercase")).toBe("abc@example.com");
    expect(transformCell("abc-XyZ", "uppercase")).toBe("ABC-XYZ");
    expect(transformCell("山田太郎", "uppercase")).toBe("山田太郎");
    expect(transformCell(123, "lowercase")).toBe(123);
  });

  it("converts ASCII, spaces, punctuation and voiced kana in both directions", () => {
    const full = "ＡＢＣ１２３！　ガギグ。";
    const half = "ABC123! ｶﾞｷﾞｸﾞ｡";
    expect(fullWidthToHalfWidth(full)).toBe(half);
    expect(halfWidthToFullWidth(half)).toBe(full);
    expect(fullWidthToHalfWidth(fullWidthToHalfWidth(full))).toBe(half);
    expect(halfWidthToFullWidth(halfWidthToFullWidth(half))).toBe(full);
  });

  it("normalizes supported business dates and rejects calendar rollovers", () => {
    for (const value of [
      "2026/8/9",
      "2026-08-09",
      "20260809",
      "2026年8月9日",
      "２０２６／８／９",
      "2026-08-09T12:30:00",
    ]) {
      expect(transformCell(value, "date-yyyy-mm-dd")).toBe("2026-08-09");
    }
    expect(parseDateValue(1)).toEqual({ year: 1900, month: 1, day: 1 });
    expect(parseDateValue(61)).toEqual({ year: 1900, month: 3, day: 1 });
    expect(parseDateValue(60)).toBeNull();
    expect(transformCell("2024-02-29", "date-yyyy-mm-dd")).toBe("2024-02-29");
    expect(evaluateCellRule("2025-02-29", "date-yyyy-mm-dd")).toMatchObject({
      value: "2025-02-29",
      warningCode: "invalid-date",
    });
    expect(evaluateCellRule("2026-02-30", "date-yyyy-mm-dd")).toMatchObject({
      value: "2026-02-30",
      warningCode: "invalid-date",
    });
  });

  it("formats supported Japanese phone patterns while preserving invalid data", () => {
    expect(transformCell("０９０ー１２３４ー５６７８", "phone")).toBe("090-1234-5678");
    expect(transformCell("+81 90 1234 5678", "phone")).toBe("090-1234-5678");
    expect(transformCell("03 (1234) 5678", "phone")).toBe("03-1234-5678");
    expect(transformCell("0120 123 456", "phone")).toBe("0120-123-456");
    expect(transformCell("0800 123 4567", "phone")).toBe("0800-123-4567");
    expect(transformCell("(0466) 12-3456", "phone")).toBe("0466-12-3456");
    expect(evaluateCellRule("090-1234-5678 内線12", "phone")).toMatchObject({
      value: "090-1234-5678 内線12",
      warningCode: "invalid-phone",
    });
    expect(evaluateCellRule("123", "phone")).toMatchObject({
      value: "123",
      warningCode: "invalid-phone",
    });
    expect(evaluateCellRule("0466123456", "phone")).toMatchObject({
      value: "0466123456",
      warningCode: "invalid-phone",
    });
  });

  it("formats exactly seven postal-code digits and warns instead of truncating", () => {
    expect(transformCell("〒１５０ ０００１", "postal-code")).toBe("150-0001");
    expect(transformCell("1000001", "postal-code")).toBe("100-0001");
    expect(transformCell("150-0001", "postal-code")).toBe("150-0001");
    expect(evaluateCellRule("123456", "postal-code")).toMatchObject({
      value: "123456",
      warningCode: "invalid-postal-code",
    });
    expect(evaluateCellRule(1_500_001, "postal-code")).toMatchObject({
      value: 1_500_001,
      warningCode: "invalid-postal-code",
    });
  });

  it("removes only valid numeric grouping commas and canonicalizes empty cells", () => {
    expect(transformCell("1,234.50", "remove-number-commas")).toBe("1234.50");
    expect(transformCell("２，５００", "remove-number-commas")).toBe("２５００");
    expect(transformCell(-1_200, "remove-number-commas")).toBe(-1_200);
    expect(evaluateCellRule("12,34", "remove-number-commas")).toMatchObject({
      value: "12,34",
      warningCode: "invalid-number",
    });
    expect(transformCell(" \t　", "empty-to-null")).toBeNull();
    expect(transformCell("0", "empty-to-null")).toBe("0");
    expect(transformCell(0, "empty-to-null")).toBe(0);
    expect(transformCell(false, "empty-to-null")).toBe(false);
    expect(evaluateCellRule("   ", "date-yyyy-mm-dd")).toEqual({ value: "   " });
    expect(evaluateCellRule("", "remove-number-commas")).toEqual({ value: "" });
  });
});

describe("immutable cleaning workflow", () => {
  function dirtyCustomerData(): DataSet {
    const headers = [
      "顧客ID",
      "氏名",
      "メール",
      "電話番号",
      "郵便番号",
      "登録日",
      "金額",
      "備考",
    ];
    return dataSet(headers, [
      row("r1", {
        顧客ID: "C-001",
        氏名: "　山田   太郎　",
        メール: "TARO@EXAMPLE.COM",
        電話番号: "０９０（１２３４）５６７８",
        郵便番号: "〒１５００００１",
        登録日: "2026/8/9",
        金額: "1,200",
        備考: "  ",
      }),
      row("r2", {
        顧客ID: "C-002",
        氏名: "佐藤 花子",
        メール: "hanako@example.com",
        電話番号: "03 1234 5678",
        郵便番号: "1000001",
        登録日: "20260810",
        金額: "２，５００",
        備考: null,
      }),
      row("r3", {
        顧客ID: "C-001",
        氏名: "山田 太郎",
        メール: "taro@example.com",
        電話番号: "090-1234-5678",
        郵便番号: "150-0001",
        登録日: "2026-08-09",
        金額: "1200",
        備考: null,
      }),
      row("r4", {
        顧客ID: "C-003",
        氏名: "鈴木 一郎",
        メール: "ichiro@example.com",
        電話番号: "123",
        郵便番号: "123456",
        登録日: "2026-02-30",
        金額: "-",
        備考: null,
      }),
    ], "customers");
  }

  const customerConfig: CleaningConfig = {
    rules: [
      { id: "trim-name", column: "氏名", kind: "trim" },
      { id: "collapse-name", column: "氏名", kind: "collapse-spaces" },
      { id: "lower-email", column: "メール", kind: "lowercase" },
      { id: "phone", column: "電話番号", kind: "phone" },
      { id: "postal", column: "郵便番号", kind: "postal-code" },
      { id: "date", column: "登録日", kind: "date-yyyy-mm-dd" },
      { id: "width-amount", column: "金額", kind: "full-width-to-half" },
      { id: "comma-amount", column: "金額", kind: "remove-number-commas" },
      { id: "empty-note", column: "備考", kind: "empty-to-null" },
    ],
    duplicateRule: { id: "dedupe", columns: [], keep: "first" },
  };

  it("produces exact Before/After coordinates, dry-run totals and warnings", () => {
    const source = dirtyCustomerData();
    const snapshot = JSON.parse(JSON.stringify(source)) as DataSet;
    const result = applyCleaning(source, customerConfig);

    expect(result.summary).toEqual({
      sourceRowCount: 4,
      outputRowCount: 3,
      sourceEmptyCount: 4,
      outputEmptyCount: 3,
      changedCellCount: 11,
      removedDuplicateCount: 1,
      warningCount: 4,
      appliedRuleCount: 10,
    });
    expect(result.warnings.map((warning) => warning.code)).toEqual([
      "invalid-phone",
      "invalid-postal-code",
      "invalid-date",
      "invalid-number",
    ]);
    expect(result.changes[0]).toEqual({
      rowId: "r1",
      rowIndex: 0,
      column: "氏名",
      columnIndex: 1,
      before: "　山田   太郎　",
      after: "山田 太郎",
      ruleIds: ["trim-name", "collapse-name"],
    });
    expect(result.changes.find((change) =>
      change.rowId === "r2" && change.column === "金額")).toMatchObject({
      before: "２，５００",
      after: "2500",
      ruleIds: ["width-amount", "comma-amount"],
    });
    expect(result.removedDuplicates).toEqual([{
      rowId: "r3",
      rowIndex: 2,
      duplicateOfRowId: "r1",
      duplicateOfRowIndex: 0,
      keyColumns: source.headers,
      keyValues: [
        "C-001",
        "山田 太郎",
        "taro@example.com",
        "090-1234-5678",
        "150-0001",
        "2026-08-09",
        "1200",
        null,
      ],
    }]);
    expect(result.cleanedDataSet.rows.map((item) => item[ROW_ID_KEY])).toEqual([
      "r1",
      "r2",
      "r4",
    ]);
    expect(source).toEqual(snapshot);
    expect(result.originalDataSet).toBe(source);
    expect(result.cleanedDataSet).not.toBe(source);
    expect(result.cleanedDataSet.rows[0]).not.toBe(source.rows[0]);
  });

  it("counts a cell once against its final value and ignores reversible rule chains", () => {
    const source = dataSet(["email"], [row("r1", { email: "abc@example.com" })]);
    const result = applyCleaning(source, {
      rules: [
        { id: "upper", column: "email", kind: "uppercase" },
        { id: "lower", column: "email", kind: "lowercase" },
      ],
    });
    expect(result.cleanedDataSet.rows[0].email).toBe("abc@example.com");
    expect(result.changes).toEqual([]);
    expect(result.summary.changedCellCount).toBe(0);
  });

  it("supports selected-column keep-last deduplication with deterministic order", () => {
    const source = dataSet(["id", "value"], [
      row("first-a", { id: "A", value: 1 }),
      row("b", { id: "B", value: 2 }),
      row("last-a", { id: "A", value: 3 }),
    ]);
    const result = applyCleaning(source, {
      rules: [],
      duplicateRule: { columns: ["id"], keep: "last" },
    });
    expect(result.cleanedDataSet.rows.map((item) => item[ROW_ID_KEY])).toEqual([
      "b",
      "last-a",
    ]);
    expect(result.removedDuplicates[0]).toMatchObject({
      rowId: "first-a",
      rowIndex: 0,
      duplicateOfRowId: "last-a",
      duplicateOfRowIndex: 2,
    });
  });

  it("keeps number and string duplicate keys distinct", () => {
    const source = dataSet(["value"], [
      row("number", { value: 1 }),
      row("string", { value: "1" }),
    ]);
    const result = applyCleaning(source, {
      rules: [],
      duplicateRule: { columns: ["value"] },
    });
    expect(result.summary.removedDuplicateCount).toBe(0);
    expect(result.cleanedDataSet.rows).toHaveLength(2);
  });

  it("skips disabled rules and reports invalid configuration without data loss", () => {
    const source = dirtyCustomerData();
    const result = applyCleaning(source, {
      rules: [
        { id: "disabled", column: "氏名", kind: "trim", enabled: false },
        { id: "missing", column: "存在しない列", kind: "trim" },
      ],
      duplicateRule: { columns: ["存在しない列"] },
    });
    expect(result.summary).toMatchObject({
      sourceRowCount: 4,
      outputRowCount: 4,
      changedCellCount: 0,
      removedDuplicateCount: 0,
      warningCount: 2,
      appliedRuleCount: 0,
    });
    expect(result.warnings.map((warning) => warning.code)).toEqual([
      "missing-column",
      "invalid-duplicate-config",
    ]);
    expect(result.cleanedDataSet.rows[0].氏名).toBe("　山田   太郎　");
  });

  it("can rerun from the untouched source after removing every rule", () => {
    const source = dirtyCustomerData();
    const cleaned = applyCleaning(source, customerConfig);
    const undone = applyCleaning(source, { rules: [] });
    expect(cleaned.cleanedDataSet.rows).toHaveLength(3);
    expect(undone.cleanedDataSet.rows).toEqual(source.rows);
    expect(undone.summary.changedCellCount).toBe(0);
    expect(undone.summary.removedDuplicateCount).toBe(0);
  });
});
