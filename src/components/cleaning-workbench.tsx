"use client";

import {
  ArrowRight,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  Download,
  Eye,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Gauge,
  HardDrive,
  Info,
  Layers3,
  ListChecks,
  LockKeyhole,
  Package,
  Play,
  Plus,
  RotateCcw,
  Save,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  Store,
  Table2,
  Trash2,
  UploadCloud,
  Users,
  WandSparkles,
  X,
  Zap,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ComponentType,
  type DragEvent,
} from "react";

import { ImobileAd } from "@/components/ads/ImobileAd";
import { applyCleaning } from "@/lib/cleaning-engine";
import { readBrowserFile } from "@/lib/file-io";
import {
  DEMO_DATASETS,
  loadDemo,
  type DemoId,
} from "@/lib/demo-data";
import { profileData } from "@/lib/profiling";
import {
  getRuleLabel,
  recommendCleaningConfig,
  RULE_DEFINITIONS,
  RULE_DEFINITION_MAP,
} from "@/lib/rule-catalog";
import {
  createTemplate,
  BUILT_IN_TEMPLATES,
  deleteTemplate,
  isBuiltInTemplate,
  isTemplateCompatible,
  loadTemplates,
  saveTemplate,
} from "@/lib/template-store";
import {
  ROW_ID_KEY,
  type CellRuleKind,
  type CellValue,
  type CleaningConfig,
  type CleaningResult,
  type CleaningTemplate,
  type ColumnRule,
  type DataSet,
  type InferredDataType,
  type ProfileIssueKind,
} from "@/lib/types";
import { validateCleaning } from "@/lib/validation";

type StepId =
  | "source"
  | "profile"
  | "detect"
  | "rules"
  | "preview"
  | "clean"
  | "validate"
  | "export"
  | "template";

interface IconProps {
  size?: number | string;
  strokeWidth?: number | string;
  "aria-hidden"?: boolean | "true" | "false";
}

interface WorkflowStep {
  id: StepId;
  label: string;
  description: string;
  title: string;
  intro: string;
  icon: ComponentType<IconProps>;
}

const WORKFLOW_STEPS: readonly WorkflowStep[] = [
  { id: "source", label: "ファイル読込", description: "CSV / XLSX", title: "データを読み込む", intro: "ファイルを外部へ送信せず、このブラウザの中で読み込みます。", icon: FolderOpen },
  { id: "profile", label: "プロファイル", description: "データ品質を把握", title: "データの状態を把握", intro: "行数・列数・欠損・重複・型・ユニーク値をコードで算出します。", icon: BarChart3 },
  { id: "detect", label: "問題検出", description: "表記ゆれを発見", title: "修正候補を検出", intro: "セル単位の問題と、安全に適用できるクレンジング候補を確認します。", icon: SearchCheck },
  { id: "rules", label: "Rule設定", description: "列ごとに指定", title: "列ごとのRuleを設定", intro: "電話、日付、メールなど、列の意味に合わせて変換方法を組み立てます。", icon: ListChecks },
  { id: "preview", label: "Before / After", description: "変更箇所を比較", title: "変換前後を比較", intro: "確定前に元データと変換後を並べ、変更セルをハイライトします。", icon: Eye },
  { id: "clean", label: "Dry Run / 実行", description: "件数を確認して適用", title: "Dry Runを確認して実行", intro: "修正セル・重複削除・警告の予定件数を確認してから一括適用します。", icon: Play },
  { id: "validate", label: "検証", description: "出力前チェック", title: "クレンジング結果を検証", intro: "列構成・重複・形式・欠損を再評価し、未解決項目を明示します。", icon: ClipboardCheck },
  { id: "export", label: "Export", description: "CSV / XLSX / Report", title: "結果をExport", intro: "クレンジング済みデータと、処理内容を記録したCleaning Reportを出力します。", icon: Download },
  { id: "template", label: "Template", description: "設定を保存・再利用", title: "RuleをTemplateとして再利用", intro: "データ本体は保存せず、列名とクレンジングRuleだけをブラウザへ保存します。", icon: Layers3 },
] as const;

const TYPE_LABELS: Record<InferredDataType, string> = {
  empty: "空欄",
  string: "文字列",
  number: "数値",
  date: "日付",
  boolean: "真偽値",
  phone: "電話番号",
  "postal-code": "郵便番号",
  email: "メール",
};

const ISSUE_LABELS: Partial<Record<ProfileIssueKind, string>> = {
  "missing-value": "欠損値",
  "duplicate-row": "重複行",
  "leading-trailing-space": "前後空白",
  "repeated-space": "連続空白",
  "full-width-character": "全角文字混在",
  "half-width-kana": "半角カナ混在",
  "mixed-case": "大文字・小文字混在",
  "phone-format": "電話番号形式",
  "invalid-phone": "電話番号要確認",
  "postal-code-format": "郵便番号形式",
  "invalid-postal-code": "郵便番号要確認",
  "date-format": "日付形式",
  "invalid-date": "日付要確認",
  "numeric-comma": "数値カンマ",
};

const ISSUE_GROUPS = [
  { id: "space", title: "空白のゆれ", note: "前後空白・連続空白", kinds: ["leading-trailing-space", "repeated-space"] as ProfileIssueKind[], icon: Zap },
  { id: "width", title: "全角・半角混在", note: "英数字・記号・カナ", kinds: ["full-width-character", "half-width-kana"] as ProfileIssueKind[], icon: Sparkles },
  { id: "formats", title: "形式の不統一", note: "電話・郵便・日付・数値", kinds: ["phone-format", "postal-code-format", "date-format", "numeric-comma"] as ProfileIssueKind[], icon: FileCheck2 },
  { id: "invalid", title: "要確認の値", note: "安全に自動変換できない値", kinds: ["invalid-phone", "invalid-postal-code", "invalid-date"] as ProfileIssueKind[], icon: CircleAlert },
  { id: "empty", title: "欠損値", note: "空文字・null", kinds: ["missing-value"] as ProfileIssueKind[], icon: Info },
  { id: "duplicate", title: "重複行", note: "同一値を持つ行", kinds: ["duplicate-row"] as ProfileIssueKind[], icon: Layers3 },
] as const;

function cloneConfig(config: CleaningConfig): CleaningConfig {
  return structuredClone(config);
}

function cellText(value: CellValue | undefined): string {
  if (value === null || value === undefined || value === "") return "空欄";
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

function fileSizeText(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function downloadBytes(bytes: Uint8Array, fileName: string, mimeType: string): void {
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const url = URL.createObjectURL(new Blob([buffer], { type: mimeType }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function MetricCard({
  label,
  value,
  note,
  tone = "blue",
  icon: Icon,
}: {
  label: string;
  value: number | string;
  note: string;
  tone?: "blue" | "green" | "amber" | "red" | "purple";
  icon: ComponentType<IconProps>;
}) {
  return (
    <div className={`metric-card ${tone}`}>
      <div className="metric-label"><span>{label}</span><Icon size={16} aria-hidden="true" /></div>
      <div className="metric-value">{typeof value === "number" ? value.toLocaleString("ja-JP") : value}</div>
      <div className="metric-note">{note}</div>
    </div>
  );
}

function PanelHeader({
  icon: Icon,
  title,
  description,
  actions,
}: {
  icon: ComponentType<IconProps>;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="panel-header">
      <div className="panel-title">
        <span className="panel-title-icon"><Icon size={17} aria-hidden="true" /></span>
        <div><h2>{title}</h2>{description ? <p>{description}</p> : null}</div>
      </div>
      {actions ? <div className="panel-actions">{actions}</div> : null}
    </div>
  );
}

function DataGrid({ dataSet, maxRows = 8 }: { dataSet: DataSet; maxRows?: number }) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead><tr><th className="row-number">#</th>{dataSet.headers.map((header) => <th key={header}>{header}</th>)}</tr></thead>
        <tbody>
          {dataSet.rows.slice(0, maxRows).map((row, rowIndex) => (
            <tr key={row[ROW_ID_KEY]}>
              <td className="row-number">{rowIndex + 1}</td>
              {dataSet.headers.map((header) => {
                const value = row[header];
                const empty = value === null || value === "";
                return <td key={header}><span className={empty ? "cell-value cell-empty" : "cell-value"} title={cellText(value)}>{cellText(value)}</span></td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ComparisonTables({ result }: { result: CleaningResult }) {
  const changeMap = useMemo(
    () => new Map(result.changes.map((change) => [`${change.rowId}\u0000${change.column}`, change])),
    [result.changes],
  );
  const cleanedRows = useMemo(
    () => new Map(result.cleanedDataSet.rows.map((row) => [row[ROW_ID_KEY], row])),
    [result.cleanedDataSet.rows],
  );
  const removedIds = useMemo(
    () => new Set(result.removedDuplicates.map((removed) => removed.rowId)),
    [result.removedDuplicates],
  );
  const source = result.originalDataSet;

  const table = (mode: "before" | "after") => (
    <div className="comparison-side">
      <div className="comparison-caption">
        <span className={`badge ${mode === "before" ? "amber" : "green"}`}>{mode === "before" ? "Before / 元データ" : "After / 変換後"}</span>
        <small>{mode === "before" ? `${source.rows.length}行` : `${result.cleanedDataSet.rows.length}行`}</small>
      </div>
      <div className="table-wrap comparison-table-wrap">
        <table className="data-table">
          <thead><tr><th className="row-number">#</th>{source.headers.map((header) => <th key={header}>{header}</th>)}</tr></thead>
          <tbody>
            {source.rows.slice(0, 10).map((sourceRow, rowIndex) => {
              const rowId = sourceRow[ROW_ID_KEY];
              const cleanedRow = cleanedRows.get(rowId);
              const deleted = removedIds.has(rowId);
              return (
                <tr key={rowId} className={deleted ? "row-deleted" : undefined}>
                  <td className="row-number">{rowIndex + 1}</td>
                  {source.headers.map((header) => {
                    const changed = changeMap.has(`${rowId}\u0000${header}`);
                    const value = mode === "before" ? sourceRow[header] : cleanedRow?.[header];
                    const className = deleted
                      ? ""
                      : changed
                        ? mode === "before" ? "cell-changed-before" : "cell-changed-after"
                        : "";
                    return (
                      <td key={header} className={className}>
                        <span className={value === null || value === undefined || value === "" ? "cell-value cell-empty" : "cell-value"} title={deleted && mode === "after" ? "重複として削除予定" : cellText(value)}>
                          {changed ? <span className="change-dot" aria-hidden="true" /> : null}
                          {deleted && mode === "after" ? "削除予定" : cellText(value)}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <>
      <div className="preview-legend">
        <span className="legend-item"><span className="legend-swatch before" />変更前</span>
        <span className="legend-item"><span className="legend-swatch after" />変更後</span>
        <span className="legend-item"><span className="legend-swatch deleted" />重複削除予定</span>
        <span>先頭10行を表示</span>
      </div>
      <div className="comparison-grid">{table("before")}{table("after")}</div>
    </>
  );
}

function EmptyGate({
  title,
  description,
  buttonLabel,
  onClick,
}: {
  title: string;
  description: string;
  buttonLabel: string;
  onClick: () => void;
}) {
  return (
    <div className="panel empty-panel">
      <div>
        <span className="empty-panel-icon"><LockKeyhole size={25} aria-hidden="true" /></span>
        <h2>{title}</h2>
        <p>{description}</p>
        <button className="button primary" onClick={onClick}>{buttonLabel}<ArrowRight size={15} aria-hidden="true" /></button>
      </div>
    </div>
  );
}

export function CleaningWorkbench() {
  const initialDemo = useMemo(() => loadDemo("customer-master"), []);
  const [activeStep, setActiveStep] = useState<StepId>("profile");
  const [dataSets, setDataSets] = useState<DataSet[]>([initialDemo.dataSet]);
  const [activeDataSetIndex, setActiveDataSetIndex] = useState(0);
  const [config, setConfig] = useState<CleaningConfig>(() => cloneConfig(initialDemo.config));
  const [activeDemoId, setActiveDemoId] = useState<DemoId | null>(initialDemo.id);
  const [committed, setCommitted] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [loadingFile, setLoadingFile] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [templates, setTemplates] = useState<CleaningTemplate[]>(() =>
    BUILT_IN_TEMPLATES.map((template) => structuredClone(template)),
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState("builtin-customer-master");
  const [templateName, setTemplateName] = useState("顧客データ整形");
  const [selectedColumn, setSelectedColumn] = useState(initialDemo.dataSet.headers[0]);
  const [selectedRuleKind, setSelectedRuleKind] = useState<CellRuleKind>("trim");
  const inputRef = useRef<HTMLInputElement>(null);

  const dataSet = dataSets[activeDataSetIndex] ?? initialDemo.dataSet;
  const profile = useMemo(() => profileData(dataSet), [dataSet]);
  const result = useMemo(() => applyCleaning(dataSet, config), [dataSet, config]);
  const validation = useMemo(() => validateCleaning(result, config), [result, config]);
  const activeStepDefinition = WORKFLOW_STEPS.find((step) => step.id === activeStep) ?? WORKFLOW_STEPS[0];
  const activeStepIndex = WORKFLOW_STEPS.findIndex((step) => step.id === activeStep);

  useEffect(() => {
    // Browser storage is intentionally read after hydration; source data is never stored.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTemplates(loadTemplates(window.localStorage));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const showToast = useCallback((message: string) => setToast(message), []);

  const moveTo = useCallback((step: StepId) => {
    setActiveStep(step);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const nextStep = useCallback(() => {
    const next = WORKFLOW_STEPS[Math.min(activeStepIndex + 1, WORKFLOW_STEPS.length - 1)];
    if (next) moveTo(next.id);
  }, [activeStepIndex, moveTo]);

  const loadSelectedDemo = useCallback((id: DemoId) => {
    const demo = loadDemo(id);
    setDataSets([demo.dataSet]);
    setActiveDataSetIndex(0);
    setSelectedColumn(demo.dataSet.headers[0]);
    setConfig(cloneConfig(demo.config));
    setActiveDemoId(id);
    setCommitted(false);
    setTemplateName(`${demo.name}整形`);
    setSelectedTemplateId(id === "product-master" ? "builtin-ec-product-data" : "builtin-customer-master");
    moveTo("profile");
    showToast(`${demo.name}Demoを読み込みました`);
  }, [moveTo, showToast]);

  const loadFile = useCallback(async (file: File) => {
    setLoadingFile(true);
    try {
      const imported = await readBrowserFile(file);
      const first = imported.dataSets[0];
      const nextProfile = profileData(first);
      setDataSets(imported.dataSets);
      setActiveDataSetIndex(0);
      setSelectedColumn(first.headers[0] ?? "");
      setConfig(recommendCleaningConfig(first, nextProfile));
      setActiveDemoId(null);
      setCommitted(false);
      setTemplateName(`${file.name.replace(/\.(csv|xlsx)$/iu, "")}整形`);
      moveTo("profile");
      showToast(`${file.name} をブラウザ内で読み込みました`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "ファイルを読み込めませんでした");
    } finally {
      setLoadingFile(false);
    }
  }, [moveTo, showToast]);

  const onFileInput = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void loadFile(file);
    event.target.value = "";
  }, [loadFile]);

  const onDrop = useCallback((event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void loadFile(file);
  }, [loadFile]);

  const selectSheet = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
    const index = Number(event.target.value);
    const next = dataSets[index];
    if (!next) return;
    setActiveDataSetIndex(index);
    setSelectedColumn(next.headers[0] ?? "");
    setConfig(recommendCleaningConfig(next, profileData(next)));
    setCommitted(false);
    showToast(`Sheet「${next.name}」へ切り替えました`);
  }, [dataSets, showToast]);

  const updateConfig = useCallback((updater: (previous: CleaningConfig) => CleaningConfig) => {
    setConfig((previous) => updater(cloneConfig(previous)));
    setCommitted(false);
  }, []);

  const toggleRule = useCallback((ruleId: string) => {
    updateConfig((previous) => ({
      ...previous,
      rules: previous.rules.map((rule) => rule.id === ruleId ? { ...rule, enabled: rule.enabled === false } : rule),
    }));
  }, [updateConfig]);

  const removeRule = useCallback((ruleId: string) => {
    updateConfig((previous) => ({ ...previous, rules: previous.rules.filter((rule) => rule.id !== ruleId) }));
  }, [updateConfig]);

  const addRule = useCallback(() => {
    if (!selectedColumn) return;
    const exists = config.rules.some((rule) => rule.column === selectedColumn && rule.kind === selectedRuleKind);
    if (exists) {
      showToast("同じ列とRuleの組み合わせがすでにあります");
      return;
    }
    const newRule: ColumnRule = {
      id: `rule-${Date.now()}-${selectedRuleKind}`,
      column: selectedColumn,
      kind: selectedRuleKind,
      enabled: true,
    };
    updateConfig((previous) => ({ ...previous, rules: [...previous.rules, newRule] }));
    showToast(`${selectedColumn}に「${getRuleLabel(selectedRuleKind)}」を追加しました`);
  }, [config.rules, selectedColumn, selectedRuleKind, showToast, updateConfig]);

  const clearRules = useCallback(() => {
    setConfig({ rules: [], duplicateRule: { enabled: false, columns: [], keep: "first" } });
    setCommitted(false);
    showToast("Ruleを解除し、原データから再実行しました");
  }, [showToast]);

  const restoreRecommendations = useCallback(() => {
    const demo = activeDemoId ? DEMO_DATASETS.find((item) => item.id === activeDemoId) : null;
    setConfig(demo ? cloneConfig(demo.config) : recommendCleaningConfig(dataSet, profile));
    setCommitted(false);
    showToast("推奨Ruleを再設定しました");
  }, [activeDemoId, dataSet, profile, showToast]);

  const applyTemplate = useCallback(() => {
    const template = templates.find((candidate) => candidate.id === selectedTemplateId);
    if (!template) return;
    if (!isTemplateCompatible(template, dataSet)) {
      showToast("このTemplateに必要な列が現在のデータにありません");
      return;
    }
    setConfig(cloneConfig(template.config));
    setCommitted(false);
    showToast(`「${template.name}」を適用しました`);
  }, [dataSet, selectedTemplateId, showToast, templates]);

  const saveCurrentTemplate = useCallback(() => {
    try {
      const template = createTemplate(templateName, config, `${dataSet.name}用の列別クレンジング設定`);
      const next = saveTemplate(window.localStorage, template);
      setTemplates(next);
      setSelectedTemplateId(template.id);
      showToast(`Template「${template.name}」を保存しました`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Templateを保存できませんでした");
    }
  }, [config, dataSet.name, showToast, templateName]);

  const removeSavedTemplate = useCallback((templateId: string) => {
    setTemplates(deleteTemplate(window.localStorage, templateId));
    setSelectedTemplateId("builtin-customer-master");
    showToast("保存したTemplateを削除しました");
  }, [showToast]);

  const executeCleaning = useCallback(() => {
    setCommitted(true);
    showToast(`${result.summary.changedCellCount}セルを修正し、${result.summary.removedDuplicateCount}行の重複を除外しました`);
  }, [result.summary, showToast]);

  const exportCsv = useCallback(async () => {
    const { createCleanedCsv, CLEANED_CSV_FILENAME, CLEANED_CSV_MIME_TYPE } = await import("@/lib/export");
    downloadBytes(createCleanedCsv(result.cleanedDataSet), CLEANED_CSV_FILENAME, CLEANED_CSV_MIME_TYPE);
    showToast("クレンジング済みCSVを出力しました");
  }, [result, showToast]);

  const exportXlsx = useCallback(async () => {
    const { createCleanedXlsx, CLEANED_XLSX_FILENAME, CLEANED_XLSX_MIME_TYPE } = await import("@/lib/export");
    downloadBytes(createCleanedXlsx(result.cleanedDataSet), CLEANED_XLSX_FILENAME, CLEANED_XLSX_MIME_TYPE);
    showToast("クレンジング済みXLSXを出力しました");
  }, [result, showToast]);

  const exportReport = useCallback(async () => {
    const {
      createCleaningReportXlsx,
      CLEANING_REPORT_XLSX_FILENAME,
      CLEANED_XLSX_MIME_TYPE,
    } = await import("@/lib/export");
    downloadBytes(
      createCleaningReportXlsx({ result, config }),
      CLEANING_REPORT_XLSX_FILENAME,
      CLEANED_XLSX_MIME_TYPE,
    );
    showToast("Cleaning Reportを出力しました");
  }, [config, result, showToast]);

  const sourceScreen = (
    <>
      <div className="panel">
        <PanelHeader icon={UploadCloud} title="ファイルを選択" description="CSV / XLSX・最大25MB・サーバー送信なし" />
        <div className="panel-body source-grid">
          <label
            className={`drop-zone ${dragging ? "is-dragging" : ""}`}
            onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            <div>
              <span className="drop-icon"><UploadCloud size={26} aria-hidden="true" /></span>
              <strong>{loadingFile ? "ファイルを解析しています…" : "Excel / CSVをドロップ"}</strong>
              <p>またはクリックして端末から選択</p>
              <span className="badge green" style={{ marginTop: 14 }}><ShieldCheck size={13} aria-hidden="true" />ブラウザ内だけで処理</span>
            </div>
            <input ref={inputRef} type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={onFileInput} disabled={loadingFile} />
          </label>
          <div className="demo-list" aria-label="Demoデータ">
            <div><span className="eyebrow">Demo Mode</span><h2 style={{ margin: "4px 0 10px", fontSize: 15 }}>架空データですぐに試す</h2></div>
            {DEMO_DATASETS.map((demo) => {
              const Icon = demo.id === "customer-master" ? Users : demo.id === "product-master" ? Package : Store;
              return (
                <button key={demo.id} className={`demo-card ${activeDemoId === demo.id ? "is-active" : ""}`} onClick={() => loadSelectedDemo(demo.id)}>
                  <span className="demo-icon"><Icon size={18} aria-hidden="true" /></span>
                  <span className="demo-copy"><strong>{demo.name}</strong><small>{demo.dataSet.rows.length}行・{demo.dataSet.headers.length}列 / 表記ゆれ・空欄・重複</small></span>
                  <ChevronRight size={15} aria-hidden="true" />
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div className="panel">
        <PanelHeader icon={Table2} title="現在の元データ" description="読み込んだ値はこのまま保持されます" actions={<span className="badge blue">{dataSet.rows.length}行 × {dataSet.headers.length}列</span>} />
        <DataGrid dataSet={dataSet} maxRows={5} />
      </div>
    </>
  );

  const profileScreen = (
    <>
      <div className="file-strip" style={{ marginBottom: 14 }}>
        <FileSpreadsheet size={20} color="var(--blue)" aria-hidden="true" />
        <span className="file-name"><strong>{dataSet.metadata?.source?.fileName ?? dataSet.name}</strong><small>{dataSet.metadata?.source?.fileSize ? `${fileSizeText(dataSet.metadata.source.fileSize)}・` : ""}{dataSet.metadata?.source?.fileType.toUpperCase()}・ブラウザ内で解析済み</small></span>
        {dataSets.length > 1 ? (
          <label><span className="sr-only">Sheetを選択</span><select className="select" value={activeDataSetIndex} onChange={selectSheet}>{dataSets.map((sheet, index) => <option key={sheet.id} value={index}>{sheet.name}</option>)}</select></label>
        ) : <span className="badge"><Layers3 size={12} aria-hidden="true" />{dataSet.name}</span>}
        <button className="button small" onClick={() => moveTo("source")}>別のファイル</button>
      </div>
      <div className="metric-grid">
        <MetricCard label="行数" value={profile.rowCount} note="ヘッダーを除くデータ行" icon={Table2} />
        <MetricCard label="列数" value={profile.columnCount} note="プロファイル対象の列" tone="purple" icon={Layers3} />
        <MetricCard label="空欄数" value={profile.emptyCount} note="空文字・空白・null" tone="amber" icon={Info} />
        <MetricCard label="重複数" value={profile.duplicateCount} note="完全一致で削除候補の行" tone="red" icon={CircleAlert} />
      </div>
      <div className="panel">
        <PanelHeader icon={Gauge} title="列プロファイル" description="推定データ型・ユニーク値・空欄・品質を列ごとに算出" actions={<button className="button primary small" onClick={() => moveTo("detect")}>問題を確認<ArrowRight size={14} aria-hidden="true" /></button>} />
        <div className="table-wrap">
          <table className="profile-table">
            <thead><tr><th>列名</th><th>推定型</th><th>ユニーク値</th><th>空欄</th><th>検出問題</th><th>型信頼度</th></tr></thead>
            <tbody>{profile.columns.map((column) => {
              const quality = Math.round(column.typeConfidence * 100);
              return (
                <tr key={column.column}>
                  <td><span className="column-name">{column.column}</span></td>
                  <td><span className="badge blue">{TYPE_LABELS[column.inferredType]}</span></td>
                  <td>{column.uniqueCount.toLocaleString("ja-JP")}</td>
                  <td>{column.emptyCount > 0 ? <span className="badge amber">{column.emptyCount}</span> : <span className="badge green">0</span>}</td>
                  <td>{column.issueCount > 0 ? <span className="badge red">{column.issueCount}件</span> : <span className="badge green"><Check size={11} />正常</span>}</td>
                  <td><div style={{ display: "flex", alignItems: "center", gap: 8 }}><span className="quality-bar"><span style={{ width: `${quality}%` }} /></span><span>{quality}%</span></div></td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      </div>
    </>
  );

  const detectScreen = (
    <>
      <div className="issue-grid">
        {ISSUE_GROUPS.map((group) => {
          const count = group.kinds.reduce((total, kind) => total + (profile.issueSummary[kind] ?? 0), 0);
          const Icon = group.icon;
          return <div className="issue-card" key={group.id}><span className="issue-icon"><Icon size={16} aria-hidden="true" /></span><div><strong>{group.title} <span className={`badge ${count ? "amber" : "green"}`} style={{ marginLeft: 5 }}>{count}</span></strong><p>{group.note}</p></div></div>;
        })}
      </div>
      <div className="panel">
        <PanelHeader icon={SearchCheck} title="検出した問題" description={`${profile.issues.length}件のセル・行レベルの問題`} actions={<button className="button primary small" onClick={() => moveTo("rules")}>Ruleを設定<ArrowRight size={14} /></button>} />
        <div className="table-wrap">
          <table className="profile-table">
            <thead><tr><th>種別</th><th>場所</th><th>現在の値</th><th>検出内容</th><th>推奨Rule</th></tr></thead>
            <tbody>{profile.issues.slice(0, 14).map((issue, index) => (
              <tr key={`${issue.kind}-${issue.rowIndex ?? "all"}-${issue.column ?? "row"}-${index}`}>
                <td><span className={`badge ${issue.severity === "warning" ? "amber" : "blue"}`}>{ISSUE_LABELS[issue.kind] ?? issue.kind}</span></td>
                <td>{issue.rowIndex === undefined ? "全体" : `${issue.rowIndex + 1}行`} {issue.column ? `/ ${issue.column}` : ""}</td>
                <td className="mono">{cellText(issue.value)}</td>
                <td>{issue.message}</td>
                <td>{issue.suggestedRule ? <span className="badge purple"><WandSparkles size={11} />{getRuleLabel(issue.suggestedRule)}</span> : <span className="muted">手動確認</span>}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </>
  );

  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId);
  const rulesScreen = (
    <>
      <div className="template-bar">
        <span><Layers3 size={17} aria-hidden="true" />Templateから設定を呼び出す</span>
        <select className="select" aria-label="Templateを選択" value={selectedTemplateId} onChange={(event) => setSelectedTemplateId(event.target.value)}>
          {templates.map((template) => <option key={template.id} value={template.id}>{template.name}{isBuiltInTemplate(template) ? "（標準）" : ""}</option>)}
        </select>
        <button className="button small" disabled={!selectedTemplate || !isTemplateCompatible(selectedTemplate, dataSet)} onClick={applyTemplate}>適用</button>
      </div>
      <div className="panel">
        <PanelHeader icon={ListChecks} title="列別Cleaning Rule" description={`${config.rules.filter((rule) => rule.enabled !== false).length}個のRuleが有効`} actions={<button className="button small" onClick={restoreRecommendations}><Sparkles size={14} />推奨Rule</button>} />
        <div className="panel-body">
          <div className="rule-toolbar">
            <select className="select" aria-label="対象列" value={selectedColumn} onChange={(event) => setSelectedColumn(event.target.value)}>{dataSet.headers.map((header) => <option key={header}>{header}</option>)}</select>
            <select className="select" aria-label="Rule" value={selectedRuleKind} onChange={(event) => setSelectedRuleKind(event.target.value as CellRuleKind)}>{RULE_DEFINITIONS.map((rule) => <option key={rule.kind} value={rule.kind}>{rule.label}</option>)}</select>
            <button className="button primary small" onClick={addRule}><Plus size={14} />Ruleを追加</button>
          </div>
          <div className="rule-list">
            {config.rules.map((rule) => {
              const definition = RULE_DEFINITION_MAP.get(rule.kind);
              return (
                <div className={`rule-row ${rule.enabled === false ? "is-disabled" : ""}`} key={rule.id}>
                  <label className="switch" title={`${rule.column}のRuleを切り替え`}><input type="checkbox" checked={rule.enabled !== false} onChange={() => toggleRule(rule.id)} aria-label={`${rule.column}の${definition?.label ?? rule.kind}`} /><span className="switch-track" /></label>
                  <span className="rule-column"><strong>{rule.column}</strong><small>列単位</small></span>
                  <ArrowRight className="rule-arrow" size={15} aria-hidden="true" />
                  <span className="rule-action"><span className="rule-action-icon"><WandSparkles size={15} /></span><span>{definition?.label ?? rule.kind}<small style={{ display: "block", color: "var(--muted)", fontWeight: 500 }}>{definition?.category}</small></span></span>
                  <span className="rule-controls"><button className="button ghost icon-only small" onClick={() => removeRule(rule.id)} aria-label={`${rule.column}のRuleを削除`}><Trash2 size={14} /></button></span>
                </div>
              );
            })}
            <div className={`rule-row ${config.duplicateRule?.enabled === false ? "is-disabled" : ""}`}>
              <label className="switch"><input type="checkbox" aria-label="重複行を削除" checked={config.duplicateRule?.enabled !== false} onChange={() => updateConfig((previous) => ({ ...previous, duplicateRule: { ...previous.duplicateRule, enabled: previous.duplicateRule?.enabled === false, columns: previous.duplicateRule?.columns ?? [], keep: previous.duplicateRule?.keep ?? "first" } }))} /><span className="switch-track" /></label>
              <span className="rule-column"><strong>行全体</strong><small>{config.duplicateRule?.columns?.length ? config.duplicateRule.columns.join("・") : "全列一致"}</small></span>
              <ArrowRight className="rule-arrow" size={15} />
              <span className="rule-action"><span className="rule-action-icon"><Layers3 size={15} /></span><span>重複行を削除<small style={{ display: "block", color: "var(--muted)", fontWeight: 500 }}>最初の1行を保持</small></span></span>
              <span className="rule-controls"><span className="badge red">{result.summary.removedDuplicateCount}行予定</span></span>
            </div>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 14 }}><button className="button danger" onClick={clearRules}><RotateCcw size={14} />すべて解除して原データへ</button><button className="button primary" onClick={() => moveTo("preview")}>Before / Afterを見る<ArrowRight size={14} /></button></div>
    </>
  );

  const previewScreen = (
    <>
      <div className="metric-grid">
        <MetricCard label="変更予定" value={result.summary.changedCellCount} note="最終Before / After差分" icon={WandSparkles} />
        <MetricCard label="重複削除予定" value={result.summary.removedDuplicateCount} note="Rule適用後に判定" tone="red" icon={Layers3} />
        <MetricCard label="警告" value={result.summary.warningCount} note="値を保持して要確認" tone="amber" icon={CircleAlert} />
        <MetricCard label="出力予定" value={`${result.summary.outputRowCount}行`} note={`元の${result.summary.sourceRowCount}行から`} tone="green" icon={FileCheck2} />
      </div>
      <div className="panel">
        <PanelHeader icon={Eye} title="Before / After Preview" description="原データは未変更・ハイライト箇所だけが変換対象" actions={<button className="button primary small" onClick={() => moveTo("clean")}>Dry Runへ<ArrowRight size={14} /></button>} />
        <div className="panel-body"><ComparisonTables result={result} /></div>
      </div>
    </>
  );

  const cleanScreen = committed ? (
    <>
      <div className="success-hero">
        <span className="success-icon"><CheckCircle2 size={28} aria-hidden="true" /></span>
        <h2>一括クレンジングが完了しました</h2>
        <p>原データは保持されています。Ruleを変更または解除すると、いつでも元データから再実行できます。</p>
      </div>
      <div className="metric-grid panel-stack">
        <MetricCard label="修正セル数" value={result.summary.changedCellCount} note="変更したユニークセル" tone="green" icon={WandSparkles} />
        <MetricCard label="削除重複数" value={result.summary.removedDuplicateCount} note="出力対象から除外" tone="green" icon={Layers3} />
        <MetricCard label="欠損件数" value={result.summary.outputEmptyCount} note="変換後の空欄・null" tone="amber" icon={Info} />
        <MetricCard label="警告件数" value={result.summary.warningCount} note="元値を保持した項目" tone="red" icon={CircleAlert} />
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}><button className="button primary" onClick={() => moveTo("validate")}>検証へ進む<ArrowRight size={14} /></button></div>
    </>
  ) : (
    <>
      <div className="dry-run-hero">
        <div className="dry-run-summary">
          <div><span className="badge blue"><Play size={12} />Dry Run完了</span><h2>データを変更する準備ができました</h2><p>以下は確定前の予定件数です。警告の値は推測で変更せず、そのまま出力候補へ残します。</p></div>
          <div className="summary-numbers">
            <div className="summary-number"><strong>{result.summary.changedCellCount}</strong><span>変更予定セル</span></div>
            <div className="summary-number"><strong>{result.summary.removedDuplicateCount}</strong><span>重複削除予定行</span></div>
            <div className="summary-number"><strong>{result.summary.warningCount}</strong><span>警告</span></div>
          </div>
        </div>
        <div className="panel" style={{ boxShadow: "none" }}>
          <PanelHeader icon={CircleAlert} title="警告・確認事項" description="未変換のまま保持" />
          <div className="panel-body warning-list">
            {result.warnings.length ? result.warnings.slice(0, 6).map((warning, index) => <div className="warning-item" key={`${warning.code}-${warning.rowIndex}-${index}`}><CircleAlert size={15} /><div><strong>{warning.column ?? "Rule設定"} / {warning.rowIndex === undefined ? "全体" : `${warning.rowIndex + 1}行目`}</strong><p>{warning.message} {warning.value !== undefined ? `「${cellText(warning.value)}」` : ""}</p></div></div>) : <div className="warning-item" style={{ borderColor: "#cce8dc", background: "var(--green-soft)", color: "var(--green)" }}><CheckCircle2 size={15} /><div><strong>警告はありません</strong><p>すべての有効Ruleを安全に適用できます。</p></div></div>}
          </div>
        </div>
      </div>
      <div className="panel">
        <PanelHeader icon={Gauge} title="実行内容" description="Previewと同じ純粋関数の結果を確定します" />
        <div className="panel-body">
          <div className="validation-grid">
            <div className="validation-card"><span><ListChecks size={18} /></span><div><strong>{result.summary.appliedRuleCount}個のRule</strong><small>列単位で順番に実行</small></div></div>
            <div className="validation-card"><span><HardDrive size={18} /></span><div><strong>Local-first</strong><small>サーバーへの送信なし</small></div></div>
            <div className="validation-card"><span><RotateCcw size={18} /></span><div><strong>Undo可能</strong><small>元データを常に保持</small></div></div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}><button className="button success" onClick={executeCleaning}><Play size={15} />一括クレンジングを実行</button></div>
        </div>
      </div>
    </>
  );

  const validateScreen = committed ? (
    <>
      <div className="success-hero">
        <span className="success-icon"><ClipboardCheck size={28} /></span>
        <h2>検証が完了しました</h2>
        <p>{validation.unresolvedIssueCount === 0 ? "出力を妨げる未解決項目はありません。" : `${validation.unresolvedIssueCount}件の確認事項があります。自動推測はせず、該当値を保持しています。`}</p>
      </div>
      <div className="metric-grid panel-stack">
        <MetricCard label="修正セル数" value={result.summary.changedCellCount} note="最終差分で集計" tone="green" icon={WandSparkles} />
        <MetricCard label="削除重複数" value={result.summary.removedDuplicateCount} note="重複Ruleで除外" tone="green" icon={Layers3} />
        <MetricCard label="欠損件数" value={validation.missingCount} note="検証時点の欠損" tone="amber" icon={Info} />
        <MetricCard label="警告件数" value={result.summary.warningCount} note="変換できず保持" tone="red" icon={CircleAlert} />
      </div>
      <div className="panel">
        <PanelHeader icon={ShieldCheck} title="Validation checks" description={`${validation.rowCount}行 × ${validation.columnCount}列を再評価`} actions={<button className="button primary small" onClick={() => moveTo("export")}>Exportへ<ArrowRight size={14} /></button>} />
        <div className="panel-body validation-grid">
          {validation.checks.map((check) => <div className="validation-card" key={check.id}><span style={check.status === "warning" ? { background: "var(--amber-soft)", color: "var(--amber)" } : undefined}>{check.status === "passed" ? <CheckCircle2 size={18} /> : <CircleAlert size={18} />}</span><div><strong>{check.label} <span className={`badge ${check.status === "passed" ? "green" : "amber"}`} style={{ marginLeft: 4 }}>{check.status === "passed" ? "OK" : `${check.count}件`}</span></strong><small>{check.detail}</small></div></div>)}
        </div>
      </div>
    </>
  ) : <EmptyGate title="クレンジング実行後に検証できます" description="Dry Runで予定件数を確認し、一括クレンジングを実行してください。" buttonLabel="Dry Runへ戻る" onClick={() => moveTo("clean")} />;

  const exportScreen = committed ? (
    <>
      <div className="metric-grid">
        <MetricCard label="出力行数" value={result.cleanedDataSet.rows.length} note={`${result.cleanedDataSet.headers.length}列を保持`} tone="green" icon={Table2} />
        <MetricCard label="修正セル" value={result.summary.changedCellCount} note="Reportへ記録" icon={WandSparkles} />
        <MetricCard label="削除重複" value={result.summary.removedDuplicateCount} note="Reportへ記録" tone="purple" icon={Layers3} />
        <MetricCard label="要確認" value={result.summary.warningCount} note="Reportへ記録" tone="amber" icon={CircleAlert} />
      </div>
      <div className="panel">
        <PanelHeader icon={Download} title="Export" description="数式インジェクション対策済み・内部行IDは含みません" />
        <div className="panel-body export-grid">
          <div className="export-card"><span className="export-card-icon"><FileText size={20} /></span><h3>CSV</h3><p>Excelで開きやすいUTF-8 BOM付きCSVです。</p><button className="button primary" onClick={exportCsv}><Download size={14} />CSVをダウンロード</button></div>
          <div className="export-card"><span className="export-card-icon"><FileSpreadsheet size={20} /></span><h3>XLSX</h3><p>列順と値の型を維持したExcelファイルです。</p><button className="button primary" onClick={exportXlsx}><Download size={14} />XLSXをダウンロード</button></div>
          <div className="export-card"><span className="export-card-icon" style={{ background: "var(--purple-soft)", color: "var(--purple)" }}><ClipboardCheck size={20} /></span><h3>Cleaning Report</h3><p>Summary・変更・警告・重複・Ruleを収録します。</p><button className="button" onClick={exportReport}><Download size={14} />Reportをダウンロード</button></div>
        </div>
      </div>
      <div className="panel">
        <PanelHeader icon={Table2} title="出力データ確認" description="先頭5行" actions={<button className="button small" onClick={() => moveTo("template")}><Save size={14} />Template保存へ</button>} />
        <DataGrid dataSet={result.cleanedDataSet} maxRows={5} />
      </div>
    </>
  ) : <EmptyGate title="クレンジング実行後にExportできます" description="確定前のPreviewとDry Runを確認してから、データを出力してください。" buttonLabel="Dry Runへ進む" onClick={() => moveTo("clean")} />;

  const templateScreen = (
    <>
      <div className="panel">
        <PanelHeader icon={Save} title="現在の設定を保存" description="ファイル・セル値は保存せず、列名とRuleだけを保存" />
        <div className="panel-body">
          <div className="template-bar">
            <span><ShieldCheck size={17} />Local Storage / 設定のみ</span>
            <label><span className="sr-only">Template名</span><input className="input" value={templateName} maxLength={60} onChange={(event) => setTemplateName(event.target.value)} placeholder="例：顧客マスタ整形" /></label>
            <button className="button primary small" onClick={saveCurrentTemplate}><Save size={14} />Templateを保存</button>
          </div>
        </div>
      </div>
      <div className="panel">
        <PanelHeader icon={Layers3} title="保存済みTemplate" description="標準2件 + このブラウザで保存した設定" />
        <div className="panel-body rule-list">
          {templates.map((template) => {
            const builtIn = isBuiltInTemplate(template);
            const compatible = isTemplateCompatible(template, dataSet);
            return (
              <div className="rule-row" key={template.id}>
                <span className="rule-action-icon" style={{ marginLeft: 5 }}><Layers3 size={15} /></span>
                <span className="rule-column"><strong>{template.name}</strong><small>{builtIn ? "標準Template" : "このブラウザに保存"}</small></span>
                <ArrowRight className="rule-arrow" size={15} />
                <span className="rule-action"><span>{template.config.rules.length}個の列Rule<small style={{ display: "block", color: "var(--muted)", fontWeight: 500 }}>{template.description ?? "説明なし"}</small></span></span>
                <span className="rule-controls"><span className={`badge ${compatible ? "green" : "amber"}`}>{compatible ? "適用可" : "列不足"}</span><button className="button small" disabled={!compatible} onClick={() => { setConfig(cloneConfig(template.config)); setSelectedTemplateId(template.id); setCommitted(false); moveTo("rules"); showToast(`「${template.name}」を適用しました`); }}>適用</button>{!builtIn ? <button className="button ghost icon-only small" aria-label={`${template.name}を削除`} onClick={() => removeSavedTemplate(template.id)}><Trash2 size={14} /></button> : null}</span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );

  const screens: Record<StepId, React.ReactNode> = {
    source: sourceScreen,
    profile: profileScreen,
    detect: detectScreen,
    rules: rulesScreen,
    preview: previewScreen,
    clean: cleanScreen,
    validate: validateScreen,
    export: exportScreen,
    template: templateScreen,
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand button ghost" style={{ padding: 0, minHeight: 44 }} onClick={() => moveTo("profile")} aria-label="データプロファイルへ戻る">
          {/* Native img is intentional for the tiny SVG app mark; no responsive optimization is needed. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="brand-mark" src="/icons/data-cleaning-mark.svg" alt="" width="44" height="44" />
          <span className="brand-copy"><strong>Excel・CSVデータクレンジング・表記統一ツール</strong><span>Data Cleaning Workflow</span></span>
        </button>
        <div className="topbar-actions">
          <span className="privacy-pill"><ShieldCheck size={13} aria-hidden="true" />Local-first・アップロードなし</span>
          <button className="button" onClick={clearRules}><RotateCcw size={14} />原データへ戻す</button>
          <button className="button icon-only" aria-label="ファイル読込へ" onClick={() => moveTo("source")}><UploadCloud size={17} /></button>
        </div>
      </header>

      <div className="workspace">
        <aside className="workflow-rail" aria-label="Data Cleaning Workflow">
          <div className="rail-card">
            <div className="rail-heading"><span>Workflow</span><strong>9ステップで安全に整形</strong></div>
            <nav className="workflow-list">
              {WORKFLOW_STEPS.map((step, index) => {
                const Icon = step.icon;
                const isComplete = index < activeStepIndex || (committed && ["clean", "validate", "export", "template"].includes(step.id));
                return (
                  <button key={step.id} className={`workflow-step ${isComplete ? "is-complete" : ""}`} aria-current={activeStep === step.id ? "step" : undefined} onClick={() => moveTo(step.id)}>
                    <span className="step-icon">{isComplete ? <Check size={15} /> : <Icon size={15} />}</span>
                    <span className="step-copy"><strong>{step.label}</strong><small>{step.description}</small></span>
                    <ChevronRight className="step-arrow" size={14} />
                  </button>
                );
              })}
            </nav>
            <div className="rail-foot"><p><LockKeyhole size={12} style={{ verticalAlign: -2, marginRight: 5 }} />データは端末内だけで処理。原データを破壊せず、Ruleを何度でも再実行できます。</p></div>
          </div>
        </aside>

        <main className="workbench">
          <div className="stage-header">
            <div className="stage-title"><span className="eyebrow">Step {activeStepIndex + 1} / {WORKFLOW_STEPS.length}</span><h1>{activeStepDefinition.title}</h1><p>{activeStepDefinition.intro}</p></div>
            <div className="header-actions">
              <span className="badge"><FileSpreadsheet size={12} />{dataSet.name}</span>
              {activeStepIndex < WORKFLOW_STEPS.length - 1 ? <button className="button" onClick={nextStep}>次へ<ChevronRight size={14} /></button> : null}
            </div>
          </div>
          {activeStep === "source" ? <ImobileAd placement="top" slot="tool-top" /> : null}
          {screens[activeStep]}
          {activeStep === "export" && committed ? <ImobileAd placement="result" slot="tool-result" /> : null}
        </main>
      </div>

      <div className="toast-region" aria-live="polite" aria-atomic="true">
        {toast ? <div className="toast"><CheckCircle2 size={17} color="var(--green)" aria-hidden="true" /><span>{toast}</span><X size={14} style={{ marginLeft: "auto", opacity: .45 }} /></div> : null}
      </div>
    </div>
  );
}
