import { profileData } from "./profiling";
import type { CleaningConfig, CleaningResult } from "./types";

export interface ValidationCheck {
  id: "schema" | "duplicates" | "formats" | "missing-values";
  label: string;
  status: "passed" | "warning";
  detail: string;
  count: number;
}
export interface ValidationSummary {
  checks: ValidationCheck[];
  passed: boolean;
  rowCount: number;
  columnCount: number;
  missingCount: number;
  duplicateCount: number;
  formatWarningCount: number;
  unresolvedIssueCount: number;
}

const FORMAT_WARNING_CODES = new Set([
  "invalid-phone",
  "invalid-postal-code",
  "invalid-date",
  "invalid-number",
]);

export function validateCleaning(
  result: CleaningResult,
  config: CleaningConfig,
): ValidationSummary {
  const profile = profileData(result.cleanedDataSet);
  const formatWarnings = result.warnings.filter((warning) =>
    FORMAT_WARNING_CODES.has(warning.code),
  );
  const duplicatesMatter = config.duplicateRule?.enabled !== false;
  const duplicateCount = duplicatesMatter ? profile.duplicateCount : 0;
  const schemaWarning = result.cleanedDataSet.headers.length === 0;

  const checks: ValidationCheck[] = [
    {
      id: "schema",
      label: "列構成",
      status: schemaWarning ? "warning" : "passed",
      detail: schemaWarning
        ? "出力できる列がありません。"
        : `${profile.columnCount}列の構成を維持しています。`,
      count: schemaWarning ? 1 : 0,
    },
    {
      id: "duplicates",
      label: "重複検証",
      status: duplicateCount > 0 ? "warning" : "passed",
      detail: duplicatesMatter
        ? duplicateCount > 0
          ? `${duplicateCount}行の重複が残っています。`
          : "設定対象の重複は残っていません。"
        : "重複削除ルールは無効です。",
      count: duplicateCount,
    },
    {
      id: "formats",
      label: "形式検証",
      status: formatWarnings.length > 0 ? "warning" : "passed",
      detail: formatWarnings.length > 0
        ? `${formatWarnings.length}件は安全に変換できず、元の値を保持しました。`
        : "有効な形式ルールを通過しました。",
      count: formatWarnings.length,
    },
    {
      id: "missing-values",
      label: "欠損値",
      status: profile.emptyCount > 0 ? "warning" : "passed",
      detail: profile.emptyCount > 0
        ? `${profile.emptyCount}セルの欠損値があります。出力にはnullとして保持されます。`
        : "欠損値はありません。",
      count: profile.emptyCount,
    },
  ];

  const unresolvedIssueCount =
    Number(schemaWarning) + duplicateCount + formatWarnings.length;

  return {
    checks,
    passed: unresolvedIssueCount === 0,
    rowCount: profile.rowCount,
    columnCount: profile.columnCount,
    missingCount: profile.emptyCount,
    duplicateCount,
    formatWarningCount: formatWarnings.length,
    unresolvedIssueCount,
  };
}
