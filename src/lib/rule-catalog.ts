import type {
  CellRuleKind,
  CleaningConfig,
  ColumnRule,
  DataProfile,
  DataSet,
  ProfileIssueKind,
  RuleKind,
} from "./types";

export interface RuleDefinition {
  kind: CellRuleKind;
  label: string;
  shortLabel: string;
  description: string;
  category: "空白" | "文字" | "形式" | "欠損";
}
export const RULE_DEFINITIONS: readonly RuleDefinition[] = [
  { kind: "trim", label: "前後空白を削除", shortLabel: "Trim", description: "値の先頭と末尾にある半角・全角空白を取り除きます。", category: "空白" },
  { kind: "collapse-spaces", label: "連続空白を1つに整理", shortLabel: "空白整理", description: "横方向の連続した空白を半角スペース1つへ統一します。", category: "空白" },
  { kind: "full-width-to-half", label: "全角を半角へ統一", shortLabel: "全角→半角", description: "英数字・記号・カタカナを対応する半角文字へ変換します。", category: "文字" },
  { kind: "half-width-to-full", label: "半角を全角へ統一", shortLabel: "半角→全角", description: "英数字・記号・カタカナを対応する全角文字へ変換します。", category: "文字" },
  { kind: "lowercase", label: "小文字へ統一", shortLabel: "小文字化", description: "英字を小文字へ統一します。メールアドレス等に適しています。", category: "文字" },
  { kind: "uppercase", label: "大文字へ統一", shortLabel: "大文字化", description: "英字を大文字へ統一します。商品コード等に適しています。", category: "文字" },
  { kind: "phone", label: "電話番号を整形", shortLabel: "電話番号", description: "判定可能な国内電話番号をハイフン区切りへ整形します。曖昧な値は保持して警告します。", category: "形式" },
  { kind: "postal-code", label: "郵便番号を整形", shortLabel: "郵便番号", description: "7桁の郵便番号をNNN-NNNN形式へ統一します。", category: "形式" },
  { kind: "date-yyyy-mm-dd", label: "日付をYYYY-MM-DDへ統一", shortLabel: "日付", description: "安全に解釈できる日付だけをISO形式へ統一します。", category: "形式" },
  { kind: "remove-number-commas", label: "数値カンマを除去", shortLabel: "カンマ除去", description: "数値に含まれる桁区切りカンマを除去します。", category: "形式" },
  { kind: "empty-to-null", label: "空文字をnullへ統一", shortLabel: "空値統一", description: "空文字と空白だけの値を欠損値nullとして統一します。", category: "欠損" },
] as const;

export const RULE_DEFINITION_MAP = new Map(
  RULE_DEFINITIONS.map((definition) => [definition.kind, definition] as const),
);

const issueToRule: Partial<Record<ProfileIssueKind, RuleKind>> = {
  "leading-trailing-space": "trim",
  "repeated-space": "collapse-spaces",
  "full-width-character": "full-width-to-half",
  "half-width-kana": "half-width-to-full",
  "mixed-case": "lowercase",
  "phone-format": "phone",
  "postal-code-format": "postal-code",
  "date-format": "date-yyyy-mm-dd",
  "numeric-comma": "remove-number-commas",
  "missing-value": "empty-to-null",
  "duplicate-row": "remove-duplicates",
};

function ruleId(column: string, kind: CellRuleKind, index: number): string {
  return `rule-${index + 1}-${encodeURIComponent(column)}-${kind}`;
}

function pushRule(
  target: ColumnRule[],
  seen: Set<string>,
  column: string,
  kind: CellRuleKind,
): void {
  const key = `${column}\u0000${kind}`;
  if (seen.has(key)) return;
  seen.add(key);
  target.push({ id: ruleId(column, kind, target.length), column, kind, enabled: true });
}

/**
 * Creates conservative, column-scoped recommendations from profiling evidence.
 * A rule is never suggested for an invalid format because invalid source values
 * must remain visible as warnings rather than be guessed into a new value.
 */
export function recommendCleaningConfig(
  dataSet: DataSet,
  profile: DataProfile,
): CleaningConfig {
  const rules: ColumnRule[] = [];
  const seen = new Set<string>();

  for (const issue of profile.issues) {
    if (!issue.column || !dataSet.headers.includes(issue.column)) continue;
    const candidate = issueToRule[issue.kind];
    if (!candidate || candidate === "remove-duplicates") continue;
    pushRule(rules, seen, issue.column, candidate);
  }

  for (const columnProfile of profile.columns) {
    const normalizedName = columnProfile.column.toLocaleLowerCase("ja-JP");
    if (columnProfile.inferredType === "email" || /mail|メール/.test(normalizedName)) {
      pushRule(rules, seen, columnProfile.column, "trim");
      pushRule(rules, seen, columnProfile.column, "lowercase");
    }
    if (columnProfile.inferredType === "phone" || /電話|tel|phone/.test(normalizedName)) {
      pushRule(rules, seen, columnProfile.column, "phone");
    }
    if (columnProfile.inferredType === "postal-code" || /郵便|postal|zip/.test(normalizedName)) {
      pushRule(rules, seen, columnProfile.column, "postal-code");
    }
    if (columnProfile.inferredType === "date" || /日$|日付|date|登録日|更新日/.test(normalizedName)) {
      pushRule(rules, seen, columnProfile.column, "date-yyyy-mm-dd");
    }
  }

  return {
    rules,
    duplicateRule: {
      id: "remove-duplicates",
      enabled: profile.duplicateCount > 0,
      columns: [],
      keep: "first",
    },
  };
}

export function getRuleLabel(kind: RuleKind): string {
  if (kind === "remove-duplicates") return "重複行を削除";
  return RULE_DEFINITION_MAP.get(kind)?.label ?? kind;
}
