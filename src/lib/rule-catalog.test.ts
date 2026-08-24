import { describe, expect, it } from "vitest";
import { profileData } from "./profiling";
import { recommendCleaningConfig } from "./rule-catalog";
import { ROW_ID_KEY, type DataSet } from "./types";

describe("recommendCleaningConfig", () => {
  it("creates column-scoped rules from profile evidence without duplicates", () => {
    const dataSet: DataSet = {
      id: "customers",
      name: "顧客",
      headers: ["メール", "電話番号"],
      rows: [
        { [ROW_ID_KEY]: "1", メール: " USER@EXAMPLE.COM ", 電話番号: "09012345678" },
        { [ROW_ID_KEY]: "2", メール: " USER@EXAMPLE.COM ", 電話番号: "09012345678" },
      ],
    };

    const config = recommendCleaningConfig(dataSet, profileData(dataSet));
    const keys = config.rules.map((rule) => `${rule.column}:${rule.kind}`);

    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toContain("メール:trim");
    expect(keys).toContain("メール:lowercase");
    expect(keys).toContain("電話番号:phone");
    expect(config.duplicateRule?.enabled).toBe(true);
  });
});
