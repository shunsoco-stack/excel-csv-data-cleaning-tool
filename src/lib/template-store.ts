import {
  CUSTOMER_MASTER_CLEANING_CONFIG,
  PRODUCT_MASTER_CLEANING_CONFIG,
} from "./demo-data";
import {
  CELL_RULE_KINDS,
  type CellRuleKind,
  type CleaningConfig,
  type CleaningTemplate,
  type ColumnRule,
  type DataSet,
  type DuplicateRule,
} from "./types";

export const TEMPLATE_STORAGE_KEY = "data-cleaning-templates-v1";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const BUILT_IN_TIMESTAMP = "2026-08-24T00:00:00.000Z";
const BUILT_IN_TEMPLATE_IDS = new Set([
  "builtin-customer-master",
  "builtin-ec-product-data",
]);
const CELL_RULE_KIND_SET = new Set<string>(CELL_RULE_KINDS);

export const BUILT_IN_TEMPLATES: readonly CleaningTemplate[] = [
  {
    version: 1,
    id: "builtin-customer-master",
    name: "顧客マスタ整形",
    description: "氏名、電話番号、郵便番号、メール、登録日を統一し、顧客ID重複を除去します。",
    createdAt: BUILT_IN_TIMESTAMP,
    updatedAt: BUILT_IN_TIMESTAMP,
    config: structuredClone(CUSTOMER_MASTER_CLEANING_CONFIG),
  },
  {
    version: 1,
    id: "builtin-ec-product-data",
    name: "EC商品データ整形",
    description: "商品コード、商品名、カテゴリ、価格、登録日を統一し、商品コード重複を除去します。",
    createdAt: BUILT_IN_TIMESTAMP,
    updatedAt: BUILT_IN_TIMESTAMP,
    config: structuredClone(PRODUCT_MASTER_CLEANING_CONFIG),
  },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isCellRuleKind(value: unknown): value is CellRuleKind {
  return typeof value === "string" && CELL_RULE_KIND_SET.has(value);
}

function parseColumnRule(value: unknown): ColumnRule | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.id !== "string" ||
    !value.id.trim() ||
    typeof value.column !== "string" ||
    !value.column.trim() ||
    !isCellRuleKind(value.kind) ||
    (value.enabled !== undefined && typeof value.enabled !== "boolean")
  ) {
    return null;
  }
  return {
    id: value.id,
    column: value.column,
    kind: value.kind,
    ...(value.enabled === undefined ? {} : { enabled: value.enabled }),
  };
}

function parseDuplicateRule(value: unknown): DuplicateRule | null {
  if (!isRecord(value)) return null;
  if (
    (value.id !== undefined && typeof value.id !== "string") ||
    (value.enabled !== undefined && typeof value.enabled !== "boolean") ||
    (value.keep !== undefined && value.keep !== "first" && value.keep !== "last") ||
    (value.columns !== undefined && (
      !Array.isArray(value.columns) ||
      !value.columns.every((column) => typeof column === "string" && column.trim())
    ))
  ) {
    return null;
  }
  return {
    ...(typeof value.id === "string" ? { id: value.id } : {}),
    ...(typeof value.enabled === "boolean" ? { enabled: value.enabled } : {}),
    ...(Array.isArray(value.columns) ? { columns: [...value.columns] as string[] } : {}),
    ...(value.keep === "first" || value.keep === "last" ? { keep: value.keep } : {}),
  };
}

function parseCleaningConfig(value: unknown): CleaningConfig | null {
  if (!isRecord(value) || !Array.isArray(value.rules)) return null;
  const rules = value.rules.map(parseColumnRule);
  if (rules.some((rule) => rule === null)) return null;

  let duplicateRule: DuplicateRule | undefined;
  if (value.duplicateRule !== undefined) {
    const parsed = parseDuplicateRule(value.duplicateRule);
    if (!parsed) return null;
    duplicateRule = parsed;
  }

  return {
    rules: rules as ColumnRule[],
    ...(duplicateRule ? { duplicateRule } : {}),
  };
}

function parseTemplate(value: unknown): CleaningTemplate | null {
  if (!isRecord(value)) return null;
  if (
    value.version !== 1 ||
    typeof value.id !== "string" ||
    !value.id.trim() ||
    typeof value.name !== "string" ||
    !value.name.trim() ||
    (value.description !== undefined && typeof value.description !== "string") ||
    typeof value.createdAt !== "string" ||
    typeof value.updatedAt !== "string"
  ) {
    return null;
  }
  const config = parseCleaningConfig(value.config);
  if (!config) return null;

  return {
    version: 1,
    id: value.id,
    name: value.name,
    ...(typeof value.description === "string" ? { description: value.description } : {}),
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    config,
  };
}

function detachedBuiltIns(): CleaningTemplate[] {
  return BUILT_IN_TEMPLATES.map((template) => structuredClone(template));
}

export function isBuiltInTemplate(templateOrId: CleaningTemplate | string): boolean {
  const id = typeof templateOrId === "string" ? templateOrId : templateOrId.id;
  return BUILT_IN_TEMPLATE_IDS.has(id);
}

/** Load user-created templates only. Invalid/corrupt entries are ignored. */
export function loadSavedTemplates(storage: StorageLike): CleaningTemplate[] {
  try {
    const raw = storage.getItem(TEMPLATE_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(parseTemplate)
      .filter((template): template is CleaningTemplate => (
        template !== null && !isBuiltInTemplate(template)
      ));
  } catch {
    return [];
  }
}

/** Load permanent built-ins followed by templates stored in this browser. */
export function loadTemplates(storage: StorageLike): CleaningTemplate[] {
  return [...detachedBuiltIns(), ...loadSavedTemplates(storage)];
}

/**
 * Persist a strict allow-list projection of user templates. Unknown runtime
 * properties (including source rows, file bytes, previews, or results) are
 * deliberately discarded before JSON serialization.
 */
export function persistTemplates(
  storage: StorageLike,
  templates: readonly CleaningTemplate[],
): void {
  const safeTemplates = templates
    .filter((template) => !isBuiltInTemplate(template))
    .map((template) => parseTemplate(template))
    .filter((template): template is CleaningTemplate => template !== null);
  storage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(safeTemplates));
}

function uniqueTemplateId(now: Date): string {
  const randomPart = Math.random().toString(36).slice(2, 9);
  return `template-${now.getTime()}-${randomPart}`;
}

export function createTemplate(
  name: string,
  config: CleaningConfig,
  description = "",
  now = new Date(),
): CleaningTemplate {
  const normalizedName = name.trim();
  if (!normalizedName) throw new Error("テンプレート名を入力してください。");
  const safeConfig = parseCleaningConfig(config);
  if (!safeConfig) throw new Error("クレンジング設定が不正です。");
  const iso = now.toISOString();
  return {
    version: 1,
    id: uniqueTemplateId(now),
    name: normalizedName,
    ...(description.trim() ? { description: description.trim() } : {}),
    createdAt: iso,
    updatedAt: iso,
    config: safeConfig,
  };
}

export function isTemplateCompatible(
  template: CleaningTemplate,
  dataSet: DataSet,
): boolean {
  const requiredColumns = new Set(template.config.rules.map((rule) => rule.column));
  template.config.duplicateRule?.columns?.forEach((column) => requiredColumns.add(column));
  return [...requiredColumns].every((column) => dataSet.headers.includes(column));
}

export function upsertTemplate(
  templates: readonly CleaningTemplate[],
  template: CleaningTemplate,
): CleaningTemplate[] {
  if (isBuiltInTemplate(template)) return [...templates];
  const safeTemplate = parseTemplate(template);
  if (!safeTemplate) throw new Error("テンプレートが不正です。");
  return [
    ...templates.filter((candidate) => isBuiltInTemplate(candidate)),
    safeTemplate,
    ...templates.filter(
      (candidate) => !isBuiltInTemplate(candidate) && candidate.id !== safeTemplate.id,
    ),
  ];
}

export function removeTemplate(
  templates: readonly CleaningTemplate[],
  templateId: string,
): CleaningTemplate[] {
  if (isBuiltInTemplate(templateId)) return [...templates];
  return templates.filter((template) => template.id !== templateId);
}

export function saveTemplate(
  storage: StorageLike,
  template: CleaningTemplate,
): CleaningTemplate[] {
  const templates = upsertTemplate(loadTemplates(storage), template);
  persistTemplates(storage, templates);
  return templates;
}

export function deleteTemplate(
  storage: StorageLike,
  templateId: string,
): CleaningTemplate[] {
  const templates = removeTemplate(loadTemplates(storage), templateId);
  persistTemplates(storage, templates);
  return templates;
}
