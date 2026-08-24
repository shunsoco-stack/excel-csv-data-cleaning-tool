import { describe, expect, it } from "vitest";

import {
  CUSTOMER_MASTER_DEMO,
  DEMO_DATASETS,
  PRODUCT_MASTER_DEMO,
  SALES_DATA_DEMO,
  getDemoDefinition,
  loadDemo,
} from "./demo-data";
import { applyCleaning } from "./cleaning-engine";
import { ROW_ID_KEY, type CellValue, type DataSet } from "./types";

function blankCount(dataSet: DataSet): number {
  return dataSet.rows.reduce(
    (total, row) => total + dataSet.headers.filter((header) => {
      const value = row[header];
      return value === null || (typeof value === "string" && value.trim() === "");
    }).length,
    0,
  );
}

function duplicateCount(dataSet: DataSet, columns: readonly string[]): number {
  const seen = new Set<string>();
  let duplicates = 0;
  dataSet.rows.forEach((row) => {
    const key = JSON.stringify(columns.map((column) => row[column] as CellValue));
    if (seen.has(key)) duplicates += 1;
    else seen.add(key);
  });
  return duplicates;
}

describe("demo catalog", () => {
  it("exposes the three required UI-ready demos with recommended configs", () => {
    expect(DEMO_DATASETS.map(({ id, name }) => ({ id, name }))).toEqual([
      { id: "customer-master", name: "顧客マスタ" },
      { id: "product-master", name: "商品マスタ" },
      { id: "sales-data", name: "売上データ" },
    ]);

    for (const demo of DEMO_DATASETS) {
      expect(demo.description).toBeTruthy();
      expect(demo.dirtyFeatures.length).toBeGreaterThanOrEqual(5);
      expect(demo.dataSet.rows.length).toBeGreaterThanOrEqual(5);
      expect(demo.config.rules.length).toBeGreaterThan(0);
      expect(demo.config.duplicateRule?.columns?.length).toBeGreaterThan(0);
      expect(demo.dataSet.rows.every((row) => Boolean(row[ROW_ID_KEY]))).toBe(true);
    }
  });

  it("contains intentional blanks, representation variation, invalid values and duplicates", () => {
    expect(blankCount(CUSTOMER_MASTER_DEMO.dataSet)).toBeGreaterThan(0);
    expect(CUSTOMER_MASTER_DEMO.dataSet.rows.some(
      (row) => String(row.電話番号).includes("０９０"),
    )).toBe(true);
    expect(CUSTOMER_MASTER_DEMO.dataSet.rows.some(
      (row) => row.登録日 === "2026-02-30",
    )).toBe(true);
    expect(duplicateCount(CUSTOMER_MASTER_DEMO.dataSet, ["顧客ID"])).toBeGreaterThan(0);

    expect(blankCount(PRODUCT_MASTER_DEMO.dataSet)).toBeGreaterThan(0);
    expect(PRODUCT_MASTER_DEMO.dataSet.rows.some(
      (row) => String(row.商品コード).includes("Ｐ－"),
    )).toBe(true);
    expect(PRODUCT_MASTER_DEMO.dataSet.rows.some(
      (row) => String(row.価格).includes(",") || String(row.価格).includes("，"),
    )).toBe(true);
    expect(duplicateCount(PRODUCT_MASTER_DEMO.dataSet, ["商品コード"])).toBeGreaterThan(0);

    expect(blankCount(SALES_DATA_DEMO.dataSet)).toBeGreaterThan(0);
    expect(SALES_DATA_DEMO.dataSet.rows.some(
      (row) => String(row.取引日).includes("年"),
    )).toBe(true);
    expect(duplicateCount(SALES_DATA_DEMO.dataSet, ["売上ID"])).toBeGreaterThan(0);
  });

  it("uses fictitious reserved-domain email addresses", () => {
    const emails = CUSTOMER_MASTER_DEMO.dataSet.rows
      .map((row) => row.メール)
      .filter((value): value is string => typeof value === "string" && value.includes("@"));
    expect(emails.length).toBeGreaterThan(0);
    expect(emails.every((email) => email.trim().toLowerCase().endsWith(".invalid"))).toBe(true);
  });

  it("returns a pristine detached copy for each Demo load", () => {
    const first = loadDemo("customer-master");
    const second = loadDemo("customer-master");
    first.dataSet.rows[0].氏名 = "変更済み";
    first.config.rules[0].enabled = false;

    expect(second.dataSet.rows[0].氏名).not.toBe("変更済み");
    expect(second.config.rules[0].enabled).not.toBe(false);
    expect(getDemoDefinition("customer-master").dataSet.rows[0].氏名).not.toBe("変更済み");
  });

  it("populates Preview with real cell changes and duplicate-removal plans", () => {
    for (const demo of DEMO_DATASETS) {
      const result = applyCleaning(demo.dataSet, demo.config);
      expect(result.summary.changedCellCount, demo.name).toBeGreaterThan(0);
      expect(result.summary.removedDuplicateCount, demo.name).toBeGreaterThan(0);
      expect(result.summary.outputRowCount, demo.name).toBeLessThan(
        result.summary.sourceRowCount,
      );
      expect(result.originalDataSet).toBe(demo.dataSet);
    }
  });
});
