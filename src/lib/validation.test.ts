import { describe, expect, it } from "vitest";
import { applyCleaning } from "./cleaning-engine";
import { validateCleaning } from "./validation";
import { ROW_ID_KEY, type CleaningConfig, type DataSet } from "./types";

describe("validateCleaning", () => {
  it("reports unresolved formats and missing cells after the same cleaning run", () => {
    const source: DataSet = {
      id: "validation",
      name: "検証",
      headers: ["電話", "備考"],
      rows: [
        { [ROW_ID_KEY]: "1", 電話: "123", 備考: " " },
        { [ROW_ID_KEY]: "2", 電話: "123", 備考: null },
      ],
    };
    const config: CleaningConfig = {
      rules: [
        { id: "phone", column: "電話", kind: "phone" },
        { id: "empty", column: "備考", kind: "empty-to-null" },
      ],
      duplicateRule: { enabled: true },
    };

    const summary = validateCleaning(applyCleaning(source, config), config);

    expect(summary.formatWarningCount).toBe(2);
    expect(summary.missingCount).toBe(1);
    expect(summary.duplicateCount).toBe(0);
    expect(summary.passed).toBe(false);
  });
});
