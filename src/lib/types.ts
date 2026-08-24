export const ROW_ID_KEY = "__rowId" as const;

/** Values retained by the local, tabular data model. */
export type CellValue = string | number | boolean | null;

/**
 * Row IDs are internal and must never be included in exported headers.
 * Importers should generate a stable ID from the source sheet and row number.
 */
export type DataRow = Record<string, CellValue> & {
  [ROW_ID_KEY]: string;
};

export type SupportedFileType = "csv" | "xlsx";
export type FileEncoding = "utf-8" | "shift-jis" | "binary";

export interface FileMetadata {
  fileName: string;
  fileType: SupportedFileType;
  fileSize: number;
  rowCount: number;
  columnCount: number;
  sheetNames: string[];
  activeSheet?: string;
  encoding: FileEncoding;
  delimiter?: string;
  skippedSheetNames?: string[];
}

export interface DataSetMetadata {
  source?: FileMetadata;
}

export interface DataSet {
  id: string;
  name: string;
  headers: string[];
  rows: DataRow[];
  metadata?: DataSetMetadata;
}

export interface ImportedTabularFile {
  dataSet: DataSet;
  dataSets: DataSet[];
  metadata: FileMetadata;
}

export const CELL_RULE_KINDS = [
  "trim",
  "collapse-spaces",
  "full-width-to-half",
  "half-width-to-full",
  "lowercase",
  "uppercase",
  "phone",
  "postal-code",
  "date-yyyy-mm-dd",
  "remove-number-commas",
  "empty-to-null",
] as const;

export type CellRuleKind = (typeof CELL_RULE_KINDS)[number];
export type RuleKind = CellRuleKind | "remove-duplicates";

export interface ColumnRule {
  id: string;
  column: string;
  kind: CellRuleKind;
  /** Rules are enabled unless explicitly disabled. */
  enabled?: boolean;
}

export interface DuplicateRule {
  id?: string;
  /** Duplicate removal is enabled unless explicitly disabled. */
  enabled?: boolean;
  /** An omitted or empty list compares every export column. */
  columns?: string[];
  keep?: "first" | "last";
}

export interface CleaningConfig {
  rules: ColumnRule[];
  duplicateRule?: DuplicateRule;
}

export type CleaningWarningCode =
  | "missing-column"
  | "invalid-phone"
  | "invalid-postal-code"
  | "invalid-date"
  | "invalid-number"
  | "invalid-duplicate-config";

export interface CellChange {
  rowId: string;
  /** Zero-based source row index, excluding the header row. */
  rowIndex: number;
  column: string;
  /** Zero-based source column index. */
  columnIndex: number;
  before: CellValue;
  after: CellValue;
  /** Every enabled rule that materially changed this cell, in execution order. */
  ruleIds: string[];
}

export interface CleaningWarning {
  code: CleaningWarningCode;
  message: string;
  ruleId?: string;
  rowId?: string;
  rowIndex?: number;
  column?: string;
  columnIndex?: number;
  value?: CellValue;
}

export interface RemovedDuplicate {
  rowId: string;
  rowIndex: number;
  duplicateOfRowId: string;
  duplicateOfRowIndex: number;
  keyColumns: string[];
  keyValues: CellValue[];
}

export interface DryRunSummary {
  sourceRowCount: number;
  outputRowCount: number;
  sourceEmptyCount: number;
  outputEmptyCount: number;
  changedCellCount: number;
  removedDuplicateCount: number;
  warningCount: number;
  appliedRuleCount: number;
}

export interface CleaningResult {
  /** The exact caller-owned object. It is never mutated by the engine. */
  originalDataSet: DataSet;
  /** A detached, cleaned copy suitable for validation and export. */
  cleanedDataSet: DataSet;
  changes: CellChange[];
  warnings: CleaningWarning[];
  removedDuplicates: RemovedDuplicate[];
  summary: DryRunSummary;
}

export type CleaningRun = CleaningResult;

export interface CellTransformEvaluation {
  value: CellValue;
  warningCode?: Exclude<
    CleaningWarningCode,
    "missing-column" | "invalid-duplicate-config"
  >;
  warningMessage?: string;
}

export type InferredDataType =
  | "empty"
  | "string"
  | "number"
  | "date"
  | "boolean"
  | "phone"
  | "postal-code"
  | "email";

export type ProfileIssueKind =
  | "missing-value"
  | "duplicate-row"
  | "leading-trailing-space"
  | "repeated-space"
  | "full-width-character"
  | "half-width-kana"
  | "mixed-case"
  | "phone-format"
  | "invalid-phone"
  | "postal-code-format"
  | "invalid-postal-code"
  | "date-format"
  | "invalid-date"
  | "numeric-comma";

export interface ProfileIssue {
  kind: ProfileIssueKind;
  severity: "info" | "warning";
  message: string;
  rowId?: string;
  rowIndex?: number;
  column?: string;
  columnIndex?: number;
  value?: CellValue;
  suggestedRule?: RuleKind;
}

export interface ColumnProfile {
  column: string;
  columnIndex: number;
  rowCount: number;
  emptyCount: number;
  nonEmptyCount: number;
  /** Distinct non-empty raw values; number 1 and string "1" remain distinct. */
  uniqueCount: number;
  duplicateValueCount: number;
  inferredType: InferredDataType;
  typeConfidence: number;
  issueCount: number;
  sampleValues: CellValue[];
}

export interface DataProfile {
  rowCount: number;
  columnCount: number;
  emptyCount: number;
  /** Number of raw rows removable by a keep-first exact duplicate rule. */
  duplicateCount: number;
  uniqueRowCount: number;
  columns: ColumnProfile[];
  issues: ProfileIssue[];
  issueSummary: Partial<Record<ProfileIssueKind, number>>;
}

export interface CleaningTemplate {
  version: 1;
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  config: CleaningConfig;
}
