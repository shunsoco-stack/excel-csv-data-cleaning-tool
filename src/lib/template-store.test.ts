import { describe, expect, it } from "vitest";

import {
  BUILT_IN_TEMPLATES,
  TEMPLATE_STORAGE_KEY,
  createTemplate,
  deleteTemplate,
  isTemplateCompatible,
  loadSavedTemplates,
  loadTemplates,
  persistTemplates,
  removeTemplate,
  saveTemplate,
  upsertTemplate,
  type StorageLike,
} from "./template-store";
import { CUSTOMER_MASTER_DEMO } from "./demo-data";
import type { CleaningConfig, CleaningTemplate } from "./types";

class MemoryStorage implements StorageLike {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

const simpleConfig: CleaningConfig = {
  rules: [
    { id: "name-trim", column: "氏名", kind: "trim" },
    { id: "email-lower", column: "メール", kind: "lowercase" },
  ],
  duplicateRule: { id: "duplicates", columns: ["顧客ID"], keep: "first" },
};

describe("built-in cleaning templates", () => {
  it("always exposes the two required built-ins", () => {
    const storage = new MemoryStorage();
    const templates = loadTemplates(storage);
    expect(templates.map((template) => template.name)).toEqual([
      "顧客マスタ整形",
      "EC商品データ整形",
    ]);
    expect(BUILT_IN_TEMPLATES.every((template) => template.version === 1)).toBe(true);
    expect(templates.every((template) => template.config.rules.length > 0)).toBe(true);
  });

  it("returns detached built-ins so consumers cannot mutate defaults", () => {
    const storage = new MemoryStorage();
    const first = loadTemplates(storage);
    first[0].name = "変更";
    first[0].config.rules[0].enabled = false;
    const second = loadTemplates(storage);
    expect(second[0].name).toBe("顧客マスタ整形");
    expect(second[0].config.rules[0].enabled).not.toBe(false);
  });
});

describe("user template persistence", () => {
  it("creates a versioned detached template with normalized text", () => {
    const now = new Date("2026-08-24T01:02:03.000Z");
    const template = createTemplate("  月次顧客整形  ", simpleConfig, "  営業部用  ", now);

    expect(template).toMatchObject({
      version: 1,
      name: "月次顧客整形",
      description: "営業部用",
      createdAt: "2026-08-24T01:02:03.000Z",
      updatedAt: "2026-08-24T01:02:03.000Z",
    });
    expect(template.id).toMatch(/^template-/u);
    simpleConfig.rules[0].column = "破壊的変更";
    expect(template.config.rules[0].column).toBe("氏名");
  });

  it("persists only allow-listed settings and never source rows or file bytes", () => {
    const storage = new MemoryStorage();
    const template = createTemplate(
      "安全な設定",
      {
        rules: [{ id: "trim", column: "氏名", kind: "trim" }],
      },
      "",
      new Date("2026-08-24T00:00:00.000Z"),
    ) as CleaningTemplate & {
      sourceData: unknown;
      config: CleaningConfig & { rows: unknown; fileBytes: unknown };
    };
    template.sourceData = [{ 氏名: "SECRET_PERSON" }];
    template.config.rows = [{ 氏名: "SECRET_ROW" }];
    template.config.fileBytes = [83, 69, 67, 82, 69, 84];

    persistTemplates(storage, [...loadTemplates(storage), template]);
    const raw = storage.getItem(TEMPLATE_STORAGE_KEY) ?? "";

    expect(raw).not.toContain("SECRET");
    expect(raw).not.toContain("sourceData");
    expect(raw).not.toContain("fileBytes");
    expect(raw).not.toContain("builtin-customer-master");
    expect(loadSavedTemplates(storage)).toHaveLength(1);
    expect(loadSavedTemplates(storage)[0].config).toEqual({
      rules: [{ id: "trim", column: "氏名", kind: "trim" }],
    });
  });

  it("ignores corrupt or schema-incompatible saved data", () => {
    const storage = new MemoryStorage();
    storage.setItem(TEMPLATE_STORAGE_KEY, "not-json");
    expect(loadTemplates(storage)).toHaveLength(2);

    storage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify([
      { version: 999, id: "old", name: "old" },
      {
        version: 1,
        id: "invalid-kind",
        name: "bad",
        createdAt: "x",
        updatedAt: "x",
        config: { rules: [{ id: "x", column: "氏名", kind: "arbitrary-code" }] },
      },
    ]));
    expect(loadSavedTemplates(storage)).toEqual([]);
    expect(loadTemplates(storage).map((template) => template.name)).toEqual([
      "顧客マスタ整形",
      "EC商品データ整形",
    ]);
  });

  it("saves, updates and deletes user templates without removing built-ins", () => {
    const storage = new MemoryStorage();
    const created = createTemplate(
      "顧客設定",
      { rules: [{ id: "trim", column: "氏名", kind: "trim" }] },
      "",
      new Date("2026-08-24T00:00:00.000Z"),
    );
    const afterSave = saveTemplate(storage, created);
    expect(afterSave).toHaveLength(3);
    expect(loadSavedTemplates(storage)).toHaveLength(1);

    const updated = { ...created, name: "顧客設定 v2", updatedAt: "2026-08-25T00:00:00.000Z" };
    const afterUpsert = upsertTemplate(afterSave, updated);
    expect(afterUpsert.filter((template) => template.id === created.id)).toHaveLength(1);
    expect(afterUpsert.find((template) => template.id === created.id)?.name).toBe("顧客設定 v2");

    const protectedBuiltIns = removeTemplate(afterUpsert, "builtin-customer-master");
    expect(protectedBuiltIns.some((template) => template.id === "builtin-customer-master")).toBe(true);

    const afterDelete = deleteTemplate(storage, created.id);
    expect(afterDelete).toHaveLength(2);
    expect(loadSavedTemplates(storage)).toEqual([]);
  });
});

describe("template compatibility", () => {
  it("checks every rule and duplicate-key column against the selected sheet", () => {
    const compatible = createTemplate("顧客", {
      rules: [{ id: "trim", column: "氏名", kind: "trim" }],
      duplicateRule: { columns: ["顧客ID"] },
    });
    const incompatible = createTemplate("不足列", {
      rules: [{ id: "trim", column: "存在しない列", kind: "trim" }],
    });

    expect(isTemplateCompatible(compatible, CUSTOMER_MASTER_DEMO.dataSet)).toBe(true);
    expect(isTemplateCompatible(incompatible, CUSTOMER_MASTER_DEMO.dataSet)).toBe(false);
  });
});
