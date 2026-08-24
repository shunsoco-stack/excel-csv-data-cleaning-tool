import {
  ROW_ID_KEY,
  type CellValue,
  type ColumnProfile,
  type DataProfile,
  type DataRow,
  type DataSet,
  type InferredDataType,
  type ProfileIssue,
  type ProfileIssueKind,
} from "./types";
import {
  buildRowKey,
  evaluateCellRule,
  fullWidthToHalfWidth,
  isEmptyCell,
  parseDateValue,
} from "./cleaning-engine";

const PHONE_HEADER = /(?:電話|携帯|phone|tel(?:ephone)?)/iu;
const POSTAL_HEADER = /(?:郵便|postal|zip)/iu;
const DATE_HEADER = /(?:日$|日付|年月日|登録日|受注日|注文日|更新日|作成日|date)/iu;
const EMAIL_HEADER = /(?:メール|mail|email)/iu;
const IDENTIFIER_HEADER = /(?:^id$|[_\s-]id$|コード|番号|code|postal|zip|phone|tel)/iu;
const REPEATED_HORIZONTAL_SPACE = /[\t \u00a0\u3000]{2,}/u;
const FULL_WIDTH_ASCII_OR_SPACE = /[！-～　]/u;
const HALF_WIDTH_KANA = /[｡-ﾟ]/u;
const ASCII_UPPER = /[A-Z]/u;
const ASCII_LOWER = /[a-z]/u;

function normalizeCell(value: CellValue | undefined): CellValue {
  return value === undefined ? null : value;
}

function typedToken(value: CellValue): string {
  if (value === null) return "null:";
  return `${typeof value}:${String(value)}`;
}

function looksLikeBoolean(value: CellValue): boolean {
  if (typeof value === "boolean") return true;
  if (typeof value !== "string") return false;
  const normalized = fullWidthToHalfWidth(value).trim().toLocaleLowerCase("ja-JP");
  return ["true", "false", "yes", "no", "はい", "いいえ", "有効", "無効"].includes(normalized);
}

function looksLikeNumber(value: CellValue, column: string): boolean {
  if (IDENTIFIER_HEADER.test(column)) return false;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "string") return false;
  const normalized = fullWidthToHalfWidth(value).trim();
  if (!/^[+-]?(?:(?:\d{1,3}(?:,\d{3})+)|\d+)(?:\.\d+)?$/u.test(normalized)) {
    return false;
  }
  const withoutSign = normalized.replace(/^[+-]/u, "").replaceAll(",", "");
  // Leading-zero identifiers must not be silently presented as numeric data.
  return !/^0\d+/u.test(withoutSign);
}

function looksLikeDate(value: CellValue, column: string): boolean {
  if (typeof value === "number") return DATE_HEADER.test(column) && parseDateValue(value) !== null;
  if (typeof value !== "string") return false;
  const normalized = fullWidthToHalfWidth(value).trim();
  const hasDateShape = /^\d{4}(?:[/.\-]\d{1,2}[/.\-]\d{1,2}|\d{4}|年\d{1,2}月\d{1,2}日)(?:[T\s].*)?$/u
    .test(normalized);
  return hasDateShape && parseDateValue(value) !== null;
}

function looksLikeEmail(value: CellValue): boolean {
  if (typeof value !== "string") return false;
  const text = value.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(text);
}

function inferType(
  column: string,
  values: readonly CellValue[],
): { type: InferredDataType; confidence: number } {
  const nonEmpty = values.filter((value) => !isEmptyCell(value));
  if (nonEmpty.length === 0) return { type: "empty", confidence: 0 };

  if (PHONE_HEADER.test(column)) {
    const valid = nonEmpty.filter((value) =>
      evaluateCellRule(value, "phone").warningCode === undefined).length;
    return { type: "phone", confidence: valid / nonEmpty.length };
  }
  if (POSTAL_HEADER.test(column)) {
    const valid = nonEmpty.filter((value) =>
      evaluateCellRule(value, "postal-code").warningCode === undefined).length;
    return { type: "postal-code", confidence: valid / nonEmpty.length };
  }
  if (EMAIL_HEADER.test(column)) {
    const valid = nonEmpty.filter(looksLikeEmail).length;
    return { type: "email", confidence: valid / nonEmpty.length };
  }

  const counts = {
    boolean: nonEmpty.filter(looksLikeBoolean).length,
    date: nonEmpty.filter((value) => looksLikeDate(value, column)).length,
    number: nonEmpty.filter((value) => looksLikeNumber(value, column)).length,
  };
  if (DATE_HEADER.test(column)) {
    return { type: "date", confidence: counts.date / nonEmpty.length };
  }

  const candidates: Array<["boolean" | "date" | "number", number]> = [
    ["boolean", counts.boolean],
    ["date", counts.date],
    ["number", counts.number],
  ];
  candidates.sort((left, right) => right[1] - left[1]);
  const [bestType, bestCount] = candidates[0];
  const confidence = bestCount / nonEmpty.length;
  return confidence >= 0.8
    ? { type: bestType, confidence }
    : { type: "string", confidence: Math.max(confidence, 1 - confidence) };
}

function addIssue(
  issues: ProfileIssue[],
  issue: ProfileIssue,
): void {
  issues.push(issue);
}

function addCellIssues(
  issues: ProfileIssue[],
  column: string,
  columnIndex: number,
  value: CellValue,
  row: DataRow,
  rowIndex: number,
  inferredType: InferredDataType,
): void {
  const coordinate = {
    rowId: row[ROW_ID_KEY],
    rowIndex,
    column,
    columnIndex,
    value,
  };

  if (isEmptyCell(value)) {
    addIssue(issues, {
      ...coordinate,
      kind: "missing-value",
      severity: "info",
      message: "空欄または空白のみのセルです。",
      suggestedRule: "empty-to-null",
    });
    return;
  }
  if (typeof value === "string") {
    if (value.trim() !== value) {
      addIssue(issues, {
        ...coordinate,
        kind: "leading-trailing-space",
        severity: "info",
        message: "値の前後に不要な空白があります。",
        suggestedRule: "trim",
      });
    }
    if (REPEATED_HORIZONTAL_SPACE.test(value)) {
      addIssue(issues, {
        ...coordinate,
        kind: "repeated-space",
        severity: "info",
        message: "連続する空白があります。",
        suggestedRule: "collapse-spaces",
      });
    }
    if (FULL_WIDTH_ASCII_OR_SPACE.test(value)) {
      addIssue(issues, {
        ...coordinate,
        kind: "full-width-character",
        severity: "info",
        message: "全角の英数字・記号・空白が含まれています。",
        suggestedRule: "full-width-to-half",
      });
    }
    if (HALF_WIDTH_KANA.test(value)) {
      addIssue(issues, {
        ...coordinate,
        kind: "half-width-kana",
        severity: "info",
        message: "半角カナが含まれています。",
        suggestedRule: "half-width-to-full",
      });
    }

    const shouldNormalizeCase = inferredType === "email"
      ? ASCII_UPPER.test(value)
      : ASCII_UPPER.test(value) && ASCII_LOWER.test(value);
    if (shouldNormalizeCase) {
      addIssue(issues, {
        ...coordinate,
        kind: "mixed-case",
        severity: "info",
        message: "大文字と小文字の表記が統一されていません。",
        suggestedRule: inferredType === "email" ? "lowercase" : undefined,
      });
    }
  }

  if (inferredType === "phone") {
    const evaluation = evaluateCellRule(value, "phone");
    if (evaluation.warningCode) {
      addIssue(issues, {
        ...coordinate,
        kind: "invalid-phone",
        severity: "warning",
        message: evaluation.warningMessage ?? "電話番号を解釈できません。",
        suggestedRule: "phone",
      });
    } else if (evaluation.value !== value) {
      addIssue(issues, {
        ...coordinate,
        kind: "phone-format",
        severity: "info",
        message: "電話番号の区切り形式が統一されていません。",
        suggestedRule: "phone",
      });
    }
  }

  if (inferredType === "postal-code") {
    const evaluation = evaluateCellRule(value, "postal-code");
    if (evaluation.warningCode) {
      addIssue(issues, {
        ...coordinate,
        kind: "invalid-postal-code",
        severity: "warning",
        message: evaluation.warningMessage ?? "郵便番号を解釈できません。",
        suggestedRule: "postal-code",
      });
    } else if (evaluation.value !== value) {
      addIssue(issues, {
        ...coordinate,
        kind: "postal-code-format",
        severity: "info",
        message: "郵便番号の区切り形式が統一されていません。",
        suggestedRule: "postal-code",
      });
    }
  }

  if (inferredType === "date") {
    const evaluation = evaluateCellRule(value, "date-yyyy-mm-dd");
    if (evaluation.warningCode) {
      addIssue(issues, {
        ...coordinate,
        kind: "invalid-date",
        severity: "warning",
        message: evaluation.warningMessage ?? "日付を解釈できません。",
        suggestedRule: "date-yyyy-mm-dd",
      });
    } else if (evaluation.value !== value) {
      addIssue(issues, {
        ...coordinate,
        kind: "date-format",
        severity: "info",
        message: "日付形式がYYYY-MM-DDではありません。",
        suggestedRule: "date-yyyy-mm-dd",
      });
    }
  }

  const numericEvaluation = evaluateCellRule(value, "remove-number-commas");
  if (
    numericEvaluation.warningCode === undefined
    && numericEvaluation.value !== value
  ) {
    addIssue(issues, {
      ...coordinate,
      kind: "numeric-comma",
      severity: "info",
      message: "数値に桁区切りカンマが含まれています。",
      suggestedRule: "remove-number-commas",
    });
  }
}

function createColumnProfile(
  dataSet: DataSet,
  column: string,
  columnIndex: number,
  issues: ProfileIssue[],
): ColumnProfile {
  const values = dataSet.rows.map((row) => normalizeCell(row[column]));
  const emptyCount = values.filter(isEmptyCell).length;
  const nonEmptyValues = values.filter((value) => !isEmptyCell(value));
  const uniqueTokens = new Set(nonEmptyValues.map(typedToken));
  const inferred = inferType(column, values);

  dataSet.rows.forEach((row, rowIndex) => {
    addCellIssues(
      issues,
      column,
      columnIndex,
      normalizeCell(row[column]),
      row,
      rowIndex,
      inferred.type,
    );
  });

  const sampleValues: CellValue[] = [];
  const sampled = new Set<string>();
  for (const value of nonEmptyValues) {
    const token = typedToken(value);
    if (sampled.has(token)) continue;
    sampled.add(token);
    sampleValues.push(value);
    if (sampleValues.length === 5) break;
  }

  return {
    column,
    columnIndex,
    rowCount: dataSet.rows.length,
    emptyCount,
    nonEmptyCount: nonEmptyValues.length,
    uniqueCount: uniqueTokens.size,
    duplicateValueCount: nonEmptyValues.length - uniqueTokens.size,
    inferredType: inferred.type,
    typeConfidence: inferred.confidence,
    issueCount: 0,
    sampleValues,
  };
}

/** Calculate all profile metrics and quality findings from the in-memory data. */
export function profileData(dataSet: DataSet): DataProfile {
  const issues: ProfileIssue[] = [];
  const columns = dataSet.headers.map((column, columnIndex) =>
    createColumnProfile(dataSet, column, columnIndex, issues));

  const firstByKey = new Map<string, number>();
  let duplicateCount = 0;
  dataSet.rows.forEach((row, rowIndex) => {
    const key = buildRowKey(row, dataSet.headers);
    const firstIndex = firstByKey.get(key);
    if (firstIndex === undefined) {
      firstByKey.set(key, rowIndex);
      return;
    }
    duplicateCount += 1;
    addIssue(issues, {
      kind: "duplicate-row",
      severity: "warning",
      message: `${firstIndex + 1}行目と同じ内容の重複行です。`,
      rowId: row[ROW_ID_KEY],
      rowIndex,
      suggestedRule: "remove-duplicates",
    });
  });

  for (const column of columns) {
    column.issueCount = issues.filter((issue) => issue.column === column.column).length;
  }

  const issueSummary: Partial<Record<ProfileIssueKind, number>> = {};
  for (const issue of issues) {
    issueSummary[issue.kind] = (issueSummary[issue.kind] ?? 0) + 1;
  }

  const emptyCount = columns.reduce((sum, column) => sum + column.emptyCount, 0);
  return {
    rowCount: dataSet.rows.length,
    columnCount: dataSet.headers.length,
    emptyCount,
    duplicateCount,
    uniqueRowCount: dataSet.rows.length - duplicateCount,
    columns,
    issues,
    issueSummary,
  };
}
