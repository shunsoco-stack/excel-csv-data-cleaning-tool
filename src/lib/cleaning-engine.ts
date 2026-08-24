import {
  ROW_ID_KEY,
  type CellRuleKind,
  type CellTransformEvaluation,
  type CellValue,
  type CleaningConfig,
  type CleaningResult,
  type CleaningWarning,
  type ColumnRule,
  type DataRow,
  type DataSet,
  type RemovedDuplicate,
} from "./types";

export interface DateParts {
  year: number;
  month: number;
  day: number;
}

const HORIZONTAL_SPACE_RUN = /[\t \u00a0\u3000]+/gu;
const PHONE_DASHES = /[‐‑‒–—―−ーｰ]/gu;
const POSTAL_DASHES = /[‐‑‒–—―−ーｰ]/gu;

const KANA_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["。", "｡"], ["「", "｢"], ["」", "｣"], ["、", "､"], ["・", "･"],
  ["ヲ", "ｦ"], ["ァ", "ｧ"], ["ィ", "ｨ"], ["ゥ", "ｩ"], ["ェ", "ｪ"],
  ["ォ", "ｫ"], ["ャ", "ｬ"], ["ュ", "ｭ"], ["ョ", "ｮ"], ["ッ", "ｯ"],
  ["ー", "ｰ"], ["ア", "ｱ"], ["イ", "ｲ"], ["ウ", "ｳ"], ["エ", "ｴ"],
  ["オ", "ｵ"], ["カ", "ｶ"], ["キ", "ｷ"], ["ク", "ｸ"], ["ケ", "ｹ"],
  ["コ", "ｺ"], ["サ", "ｻ"], ["シ", "ｼ"], ["ス", "ｽ"], ["セ", "ｾ"],
  ["ソ", "ｿ"], ["タ", "ﾀ"], ["チ", "ﾁ"], ["ツ", "ﾂ"], ["テ", "ﾃ"],
  ["ト", "ﾄ"], ["ナ", "ﾅ"], ["ニ", "ﾆ"], ["ヌ", "ﾇ"], ["ネ", "ﾈ"],
  ["ノ", "ﾉ"], ["ハ", "ﾊ"], ["ヒ", "ﾋ"], ["フ", "ﾌ"], ["ヘ", "ﾍ"],
  ["ホ", "ﾎ"], ["マ", "ﾏ"], ["ミ", "ﾐ"], ["ム", "ﾑ"], ["メ", "ﾒ"],
  ["モ", "ﾓ"], ["ヤ", "ﾔ"], ["ユ", "ﾕ"], ["ヨ", "ﾖ"], ["ラ", "ﾗ"],
  ["リ", "ﾘ"], ["ル", "ﾙ"], ["レ", "ﾚ"], ["ロ", "ﾛ"], ["ワ", "ﾜ"],
  ["ン", "ﾝ"], ["゛", "ﾞ"], ["゜", "ﾟ"],
  ["ガ", "ｶﾞ"], ["ギ", "ｷﾞ"], ["グ", "ｸﾞ"], ["ゲ", "ｹﾞ"], ["ゴ", "ｺﾞ"],
  ["ザ", "ｻﾞ"], ["ジ", "ｼﾞ"], ["ズ", "ｽﾞ"], ["ゼ", "ｾﾞ"], ["ゾ", "ｿﾞ"],
  ["ダ", "ﾀﾞ"], ["ヂ", "ﾁﾞ"], ["ヅ", "ﾂﾞ"], ["デ", "ﾃﾞ"], ["ド", "ﾄﾞ"],
  ["バ", "ﾊﾞ"], ["ビ", "ﾋﾞ"], ["ブ", "ﾌﾞ"], ["ベ", "ﾍﾞ"], ["ボ", "ﾎﾞ"],
  ["パ", "ﾊﾟ"], ["ピ", "ﾋﾟ"], ["プ", "ﾌﾟ"], ["ペ", "ﾍﾟ"], ["ポ", "ﾎﾟ"],
  ["ヴ", "ｳﾞ"],
];

const FULL_TO_HALF_KANA = new Map(KANA_PAIRS);
const HALF_TO_FULL_KANA = new Map(
  KANA_PAIRS.map(([full, half]) => [half, full] as const),
);

function normalizeCell(value: CellValue | undefined): CellValue {
  return value === undefined ? null : value;
}

export function isEmptyCell(value: CellValue | undefined): boolean {
  return value === null || value === undefined
    || (typeof value === "string" && value.trim().length === 0);
}

export function collapseSpaces(value: string): string {
  return value.replace(HORIZONTAL_SPACE_RUN, " ");
}

export function fullWidthToHalfWidth(value: string): string {
  let result = "";
  for (const character of value.normalize("NFC")) {
    const kana = FULL_TO_HALF_KANA.get(character);
    if (kana !== undefined) {
      result += kana;
      continue;
    }
    const code = character.charCodeAt(0);
    if (code >= 0xff01 && code <= 0xff5e) {
      result += String.fromCharCode(code - 0xfee0);
    } else if (character === "　") {
      result += " ";
    } else if (character === "￥") {
      result += "¥";
    } else {
      result += character;
    }
  }
  return result;
}

export function halfWidthToFullWidth(value: string): string {
  let result = "";
  for (let index = 0; index < value.length; index += 1) {
    const pair = value.slice(index, index + 2);
    const pairedKana = HALF_TO_FULL_KANA.get(pair);
    if (pairedKana !== undefined) {
      result += pairedKana;
      index += 1;
      continue;
    }

    const character = value[index];
    const kana = HALF_TO_FULL_KANA.get(character);
    if (kana !== undefined) {
      result += kana;
      continue;
    }
    const code = character.charCodeAt(0);
    if (code >= 0x21 && code <= 0x7e) {
      result += String.fromCharCode(code + 0xfee0);
    } else if (character === " ") {
      result += "　";
    } else if (character === "¥") {
      result += "￥";
    } else {
      result += character;
    }
  }
  return result;
}

function validDateParts(parts: DateParts): boolean {
  if (!Number.isInteger(parts.year) || parts.year < 1 || parts.year > 9999) return false;
  if (!Number.isInteger(parts.month) || parts.month < 1 || parts.month > 12) return false;
  if (!Number.isInteger(parts.day) || parts.day < 1 || parts.day > 31) return false;
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  return date.getUTCFullYear() === parts.year
    && date.getUTCMonth() === parts.month - 1
    && date.getUTCDate() === parts.day;
}

function partsFromMatch(match: RegExpMatchArray): DateParts | null {
  const parts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
  return validDateParts(parts) ? parts : null;
}

function excelSerialToDateParts(serial: number): DateParts | null {
  if (!Number.isFinite(serial) || serial < 1 || serial > 2_958_465) return null;
  const wholeDays = Math.floor(serial);
  // Excel's serial 60 represents the fictional 1900-02-29. Refuse to silently
  // turn it into another date; serials after it are offset by that fake day.
  if (wholeDays === 60) return null;
  const adjustedDays = wholeDays > 60 ? wholeDays - 1 : wholeDays;
  const date = new Date(Date.UTC(1899, 11, 31) + adjustedDays * 86_400_000);
  const parts = {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
  return validDateParts(parts) ? parts : null;
}

export function parseDateValue(value: CellValue): DateParts | null {
  if (typeof value === "number") {
    if (Number.isInteger(value)) {
      const compact = String(value);
      const compactMatch = compact.match(/^(\d{4})(\d{2})(\d{2})$/u);
      if (compactMatch) return partsFromMatch(compactMatch);
    }
    return excelSerialToDateParts(value);
  }
  if (typeof value !== "string") return null;

  const normalized = fullWidthToHalfWidth(value).trim();
  const patterns = [
    /^(\d{4})[/.](\d{1,2})[/.](\d{1,2})(?:[T\s].*)?$/u,
    /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/u,
    /^(\d{4})(\d{2})(\d{2})$/u,
    /^(\d{4})年(\d{1,2})月(\d{1,2})日$/u,
  ];
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) return partsFromMatch(match);
  }
  return null;
}

export function formatDateAsIso(parts: DateParts): string {
  if (!validDateParts(parts)) throw new Error("実在しない日付です。");
  const year = String(parts.year).padStart(4, "0");
  const month = String(parts.month).padStart(2, "0");
  const day = String(parts.day).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizePhone(value: string): string | null {
  const normalized = fullWidthToHalfWidth(value)
    .trim()
    .replace(PHONE_DASHES, "-");
  if (!/^[+\d\s()\-]+$/u.test(normalized)) return null;

  const plusCount = (normalized.match(/\+/gu) ?? []).length;
  if (plusCount > 1 || (plusCount === 1 && !normalized.startsWith("+81"))) return null;

  let digits: string;
  if (normalized.startsWith("+81")) {
    const internationalNational = normalized.slice(3).replace(/[^\d]/gu, "");
    if (internationalNational.length === 0) return null;
    digits = internationalNational.startsWith("0")
      ? internationalNational
      : `0${internationalNational}`;
  } else {
    digits = normalized.replace(/[^\d]/gu, "");
  }

  if (/^0800\d{7}$/u.test(digits)) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (/^(?:050|070|080|090)\d{8}$/u.test(digits)) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  if (/^0120\d{6}$/u.test(digits)) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (/^(?:03|06)\d{8}$/u.test(digits)) {
    return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  // If the source explicitly supplies three groups, preserve its area/local
  // split instead of guessing from an incomplete Japanese area-code table.
  const grouped = normalized
    .replace(/[()\s]+/gu, "-")
    .replace(/-+/gu, "-")
    .replace(/^-|-$/gu, "")
    .split("-");
  if (
    digits.length === 10
    && grouped.length === 3
    && grouped.every((group) => /^\d+$/u.test(group))
    && grouped.map((group) => group.length).reduce((sum, length) => sum + length, 0) === 10
    && grouped[0].startsWith("0")
    && grouped[0].length >= 2
    && grouped[0].length <= 5
    && grouped[1].length >= 1
    && grouped[1].length <= 4
    && grouped[2].length === 4
  ) {
    return grouped.join("-");
  }
  return null;
}

function normalizePostalCode(value: string): string | null {
  const normalized = fullWidthToHalfWidth(value)
    .trim()
    .replace(POSTAL_DASHES, "-");
  if (!/^〒?[\d\s-]+$/u.test(normalized)) return null;
  const digits = normalized.replace(/^〒/u, "").replace(/[^\d]/gu, "");
  return /^\d{7}$/u.test(digits)
    ? `${digits.slice(0, 3)}-${digits.slice(3)}`
    : null;
}

function removeNumericCommas(value: string): CellTransformEvaluation {
  const trimmed = fullWidthToHalfWidth(value).trim();
  const validNumber = /^[+-]?(?:(?:\d{1,3}(?:,\d{3})+)|\d+)(?:\.\d+)?$/u;
  if (!validNumber.test(trimmed)) {
    return {
      value,
      warningCode: "invalid-number",
      warningMessage: "数値として解釈できないため、元の値を保持しました。",
    };
  }
  return { value: value.replace(/[,，]/gu, "") };
}

function ruleKind(rule: ColumnRule | CellRuleKind): CellRuleKind {
  return typeof rule === "string" ? rule : rule.kind;
}

/**
 * Evaluate one cell without mutating it. Invalid structured values fail closed:
 * the source value is retained and a warning is returned to the caller.
 */
export function evaluateCellRule(
  value: CellValue,
  rule: ColumnRule | CellRuleKind,
): CellTransformEvaluation {
  const kind = ruleKind(rule);
  if (kind === "empty-to-null") {
    return { value: isEmptyCell(value) ? null : value };
  }
  if (value === null) return { value };
  if (typeof value === "string" && isEmptyCell(value)) return { value };

  if (kind === "date-yyyy-mm-dd") {
    const parts = parseDateValue(value);
    if (!parts) {
      return {
        value,
        warningCode: "invalid-date",
        warningMessage: "実在する対応形式の日付として解釈できないため、元の値を保持しました。",
      };
    }
    return { value: formatDateAsIso(parts) };
  }

  if (kind === "remove-number-commas") {
    if (typeof value === "number") return { value };
    if (typeof value !== "string") return { value };
    return removeNumericCommas(value);
  }

  if (kind === "phone") {
    if (typeof value !== "string") {
      return {
        value,
        warningCode: "invalid-phone",
        warningMessage: "文字列の電話番号ではないため、元の値を保持しました。",
      };
    }
    const phone = normalizePhone(value);
    return phone === null
      ? {
          value,
          warningCode: "invalid-phone",
          warningMessage: "対応する電話番号形式として解釈できないため、元の値を保持しました。",
        }
      : { value: phone };
  }

  if (kind === "postal-code") {
    if (typeof value !== "string") {
      return {
        value,
        warningCode: "invalid-postal-code",
        warningMessage: "文字列の郵便番号ではないため、元の値を保持しました。",
      };
    }
    const postalCode = normalizePostalCode(value);
    return postalCode === null
      ? {
          value,
          warningCode: "invalid-postal-code",
          warningMessage: "7桁の郵便番号として解釈できないため、元の値を保持しました。",
        }
      : { value: postalCode };
  }

  if (typeof value !== "string") return { value };

  switch (kind) {
    case "trim":
      return { value: value.trim() };
    case "collapse-spaces":
      return { value: collapseSpaces(value) };
    case "full-width-to-half":
      return { value: fullWidthToHalfWidth(value) };
    case "half-width-to-full":
      return { value: halfWidthToFullWidth(value) };
    case "lowercase":
      return { value: value.toLocaleLowerCase("ja-JP") };
    case "uppercase":
      return { value: value.toLocaleUpperCase("ja-JP") };
  }
}

export function transformCell(
  value: CellValue,
  rule: ColumnRule | CellRuleKind,
): CellValue {
  return evaluateCellRule(value, rule).value;
}

function cellsEqual(left: CellValue, right: CellValue): boolean {
  return Object.is(left, right);
}

function cloneMetadata(dataSet: DataSet): DataSet["metadata"] {
  if (!dataSet.metadata) return undefined;
  return {
    ...dataSet.metadata,
    ...(dataSet.metadata.source
      ? {
          source: {
            ...dataSet.metadata.source,
            sheetNames: [...dataSet.metadata.source.sheetNames],
            ...(dataSet.metadata.source.skippedSheetNames
              ? { skippedSheetNames: [...dataSet.metadata.source.skippedSheetNames] }
              : {}),
          },
        }
      : {}),
  };
}

function cloneRows(dataSet: DataSet): DataRow[] {
  return dataSet.rows.map((sourceRow, rowIndex) => {
    const rowId = typeof sourceRow[ROW_ID_KEY] === "string"
      && sourceRow[ROW_ID_KEY].length > 0
      ? sourceRow[ROW_ID_KEY]
      : `${dataSet.id}:row-${rowIndex + 1}`;
    const row = { ...sourceRow, [ROW_ID_KEY]: rowId } as DataRow;
    for (const header of dataSet.headers) row[header] = normalizeCell(sourceRow[header]);
    return row;
  });
}

function emptyCellCount(dataSet: DataSet): number {
  let count = 0;
  for (const row of dataSet.rows) {
    for (const header of dataSet.headers) {
      if (isEmptyCell(row[header])) count += 1;
    }
  }
  return count;
}

function cellToken(value: CellValue): string {
  if (value === null) return "null:";
  return `${typeof value}:${String(value)}`;
}

export function buildRowKey(row: DataRow, columns: readonly string[]): string {
  return JSON.stringify(columns.map((column) => cellToken(normalizeCell(row[column]))));
}

function duplicateRows(
  rows: DataRow[],
  columns: string[],
  keep: "first" | "last",
): { rows: DataRow[]; removed: RemovedDuplicate[] } {
  const removed: RemovedDuplicate[] = [];
  const retained: DataRow[] = [];

  if (keep === "first") {
    const firstByKey = new Map<string, number>();
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex];
      const key = buildRowKey(row, columns);
      const firstIndex = firstByKey.get(key);
      if (firstIndex === undefined) {
        firstByKey.set(key, rowIndex);
        retained.push(row);
      } else {
        removed.push({
          rowId: row[ROW_ID_KEY],
          rowIndex,
          duplicateOfRowId: rows[firstIndex][ROW_ID_KEY],
          duplicateOfRowIndex: firstIndex,
          keyColumns: [...columns],
          keyValues: columns.map((column) => normalizeCell(row[column])),
        });
      }
    }
    return { rows: retained, removed };
  }

  const lastByKey = new Map<string, number>();
  rows.forEach((row, rowIndex) => lastByKey.set(buildRowKey(row, columns), rowIndex));
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const lastIndex = lastByKey.get(buildRowKey(row, columns))!;
    if (lastIndex === rowIndex) {
      retained.push(row);
    } else {
      removed.push({
        rowId: row[ROW_ID_KEY],
        rowIndex,
        duplicateOfRowId: rows[lastIndex][ROW_ID_KEY],
        duplicateOfRowIndex: lastIndex,
        keyColumns: [...columns],
        keyValues: columns.map((column) => normalizeCell(row[column])),
      });
    }
  }
  return { rows: retained, removed };
}

/**
 * Execute a deterministic dry run. Cell changes are calculated against the
 * original input even when several rules touch the same cell. Duplicate
 * detection runs after cell rules, so normalization-created duplicates are
 * visible before committing. The input object and every source row stay intact.
 */
export function applyCleaning(
  dataSet: DataSet,
  config: CleaningConfig,
): CleaningResult {
  const workingRows = cloneRows(dataSet);
  const warnings: CleaningWarning[] = [];
  const changesByCoordinate = new Map<string, {
    rowId: string;
    rowIndex: number;
    column: string;
    columnIndex: number;
    before: CellValue;
    after: CellValue;
    ruleIds: string[];
  }>();
  let appliedRuleCount = 0;

  for (const rule of config.rules) {
    if (rule.enabled === false) continue;
    const columnIndex = dataSet.headers.indexOf(rule.column);
    if (columnIndex < 0) {
      warnings.push({
        code: "missing-column",
        message: `列「${rule.column}」が見つからないため、ルールをスキップしました。`,
        ruleId: rule.id,
        column: rule.column,
      });
      continue;
    }
    appliedRuleCount += 1;

    for (let rowIndex = 0; rowIndex < workingRows.length; rowIndex += 1) {
      const row = workingRows[rowIndex];
      const beforeStep = normalizeCell(row[rule.column]);
      const evaluation = evaluateCellRule(beforeStep, rule);
      if (evaluation.warningCode) {
        warnings.push({
          code: evaluation.warningCode,
          message: evaluation.warningMessage ?? "値を変換できませんでした。",
          ruleId: rule.id,
          rowId: row[ROW_ID_KEY],
          rowIndex,
          column: rule.column,
          columnIndex,
          value: beforeStep,
        });
      }
      if (cellsEqual(beforeStep, evaluation.value)) continue;

      row[rule.column] = evaluation.value;
      const coordinate = `${rowIndex}\u0000${rule.column}`;
      const existing = changesByCoordinate.get(coordinate);
      if (existing) {
        existing.after = evaluation.value;
        existing.ruleIds.push(rule.id);
      } else {
        changesByCoordinate.set(coordinate, {
          rowId: row[ROW_ID_KEY],
          rowIndex,
          column: rule.column,
          columnIndex,
          before: normalizeCell(dataSet.rows[rowIndex]?.[rule.column]),
          after: evaluation.value,
          ruleIds: [rule.id],
        });
      }
    }
  }

  let cleanedRows = workingRows;
  let removedDuplicates: RemovedDuplicate[] = [];
  const duplicateRule = config.duplicateRule;
  if (duplicateRule && duplicateRule.enabled !== false) {
    const columns = duplicateRule.columns?.length
      ? [...duplicateRule.columns]
      : [...dataSet.headers];
    const missingColumns = columns.filter((column) => !dataSet.headers.includes(column));
    if (missingColumns.length > 0) {
      warnings.push({
        code: "invalid-duplicate-config",
        message: `重複判定列が見つかりません: ${missingColumns.join("、")}`,
        ruleId: duplicateRule.id ?? "remove-duplicates",
      });
    } else {
      appliedRuleCount += 1;
      const deduplicated = duplicateRows(
        workingRows,
        columns,
        duplicateRule.keep ?? "first",
      );
      cleanedRows = deduplicated.rows;
      removedDuplicates = deduplicated.removed;
    }
  }

  const changes = [...changesByCoordinate.values()]
    .filter((change) => !cellsEqual(change.before, change.after))
    .sort((left, right) => left.rowIndex - right.rowIndex
      || left.columnIndex - right.columnIndex);

  const cleanedDataSet: DataSet = {
    ...dataSet,
    headers: [...dataSet.headers],
    rows: cleanedRows,
    metadata: cloneMetadata(dataSet),
  };

  return {
    originalDataSet: dataSet,
    cleanedDataSet,
    changes,
    warnings,
    removedDuplicates,
    summary: {
      sourceRowCount: dataSet.rows.length,
      outputRowCount: cleanedRows.length,
      sourceEmptyCount: emptyCellCount(dataSet),
      outputEmptyCount: emptyCellCount(cleanedDataSet),
      changedCellCount: changes.length,
      removedDuplicateCount: removedDuplicates.length,
      warningCount: warnings.length,
      appliedRuleCount,
    },
  };
}
