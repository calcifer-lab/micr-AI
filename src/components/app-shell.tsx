"use client";

import { useEffect, useMemo, useState } from "react";
import { clsx } from "clsx";
import {
  loadSettings,
  loadStoredRecords,
  persistRecords,
  persistSettings,
} from "@/lib/storage";
import { extractEntitiesFromText, buildExtractionRecord } from "@/lib/extraction";
import { extractTextFromPdf } from "@/lib/pdf";
import { downloadRecordAsCsv, downloadRecordAsJson } from "@/lib/download";
import type {
  ExtractionRecord,
  StoredSettings,
  UploadDocument,
} from "@/types/extraction";

const MAX_FILE_SIZE = 20 * 1024 * 1024;

type AlertMessage = {
  id: string;
  type: "info" | "error" | "success";
  message: string;
};

export function AppShell() {
  const [documents, setDocuments] = useState<UploadDocument[]>([]);
  const [records, setRecords] = useState<ExtractionRecord[]>([]);
  const [settings, setSettings] = useState<StoredSettings>({});
  const [alerts, setAlerts] = useState<AlertMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRecordsHydrated, setIsRecordsHydrated] = useState(false);
  const [isSettingsHydrated, setIsSettingsHydrated] = useState(false);

  useEffect(() => {
    const storedSettings = loadSettings();
    const storedRecords = loadStoredRecords();
    setSettings(storedSettings);
    setRecords(storedRecords);
    setIsSettingsHydrated(true);
    setIsRecordsHydrated(true);
  }, []);

  useEffect(() => {
    if (isRecordsHydrated) {
      persistRecords(records);
    }
  }, [records, isRecordsHydrated]);

  useEffect(() => {
    if (isSettingsHydrated) {
      persistSettings(settings);
    }
  }, [settings, isSettingsHydrated]);

  const totalSize = useMemo(
    () => documents.reduce((acc, doc) => acc + doc.size, 0),
    [documents],
  );

  function addAlert(alert: Omit<AlertMessage, "id">) {
    setAlerts((prev) => [
      ...prev,
      { id: crypto.randomUUID(), ...alert },
    ]);
  }

  function dismissAlert(id: string) {
    setAlerts((prev) => prev.filter((alert) => alert.id !== id));
  }

  function handleFileInput(files: FileList | null) {
    if (!files?.length) return;

    const next: UploadDocument[] = [];
    Array.from(files).forEach((file) => {
      if (file.type !== "application/pdf") {
        addAlert({
          type: "error",
          message: `${file.name} 不是支持的 PDF 文件。`,
        });
        return;
      }

      if (file.size > MAX_FILE_SIZE) {
        addAlert({
          type: "error",
          message: `${file.name} 超过 20MB 限制。`,
        });
        return;
      }

      next.push({
        id: crypto.randomUUID(),
        file,
        fileName: file.name,
        size: file.size,
        addedAt: Date.now(),
        status: "ready",
        progress: 0,
      });
    });

    if (next.length) {
      setDocuments((prev) => [...prev, ...next]);
      addAlert({
        type: "success",
        message: `成功添加 ${next.length} 份文献。`,
      });
    }
  }

  function removeDocument(id: string) {
    setDocuments((prev) => prev.filter((doc) => doc.id !== id));
  }

  async function processDocuments() {
    if (!settings.apiKey) {
      addAlert({
        type: "error",
        message: "请先在右上角填写 OpenRouter API Key。",
      });
      return;
    }

    const pendingDocuments = documents.filter((doc) =>
      ["ready", "error"].includes(doc.status),
    );

    if (!pendingDocuments.length) {
      addAlert({ type: "info", message: "当前没有待处理的文件。" });
      return;
    }

    setIsProcessing(true);
    const start = performance.now();

    for (const document of pendingDocuments) {
      setDocuments((prev) =>
        prev.map((item) =>
          item.id === document.id
            ? { ...item, status: "parsing", progress: 0.1 }
            : item,
        ),
      );

      try {
        const parsingStart = performance.now();
        const rawText = await extractTextFromPdf(document.file);
        setDocuments((prev) =>
          prev.map((item) =>
            item.id === document.id
              ? { ...item, status: "extracting", progress: 0.35 }
              : item,
          ),
        );

        const entities = await extractEntitiesFromText({
          text: rawText,
          apiKey: settings.apiKey,
          model: settings.preferredModel,
        });

        const record = buildExtractionRecord({
          fileName: document.fileName,
          fileSize: document.size,
          startedAt: parsingStart,
          finishedAt: performance.now(),
          entities,
          rawText,
        });

        setRecords((prev) => [record, ...prev]);
        setDocuments((prev) =>
          prev.map((item) =>
            item.id === document.id
              ? { ...item, status: "complete", progress: 1, record }
              : item,
          ),
        );
      } catch (error) {
        console.error(error);
        const message =
          error instanceof Error ? error.message : "提取失败，请稍后重试";
        setDocuments((prev) =>
          prev.map((item) =>
            item.id === document.id
              ? { ...item, status: "error", progress: 1, error: message }
              : item,
          ),
        );
        addAlert({ type: "error", message });
      }
    }

    setIsProcessing(false);
    const duration = performance.now() - start;
    addAlert({
      type: "info",
      message: `任务完成，总耗时 ${(duration / 1000).toFixed(1)} 秒。`,
    });
  }

  function handleSettingsChange(partial: Partial<StoredSettings>) {
    setSettings((prev) => ({ ...prev, ...partial }));
  }

  function clearRecords() {
    setRecords([]);
    persistRecords([]);
    addAlert({ type: "info", message: "已清空历史记录。" });
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-primary-600">
              micr-AI
            </p>
            <h1 className="text-2xl font-bold text-slate-900">
              文献中的微生物信息，一键提取
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              支持批量 PDF 上传，自动提取菌种、抗药性、分离来源等关键信息，并提供结构化导出。
            </p>
          </div>
          <SettingsPanel
            settings={settings}
            onChange={handleSettingsChange}
            onClearRecords={clearRecords}
          />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-6">
        <section>
          <UploadSection
            documents={documents}
            onFileInput={handleFileInput}
            onRemove={removeDocument}
            onProcess={processDocuments}
            isProcessing={isProcessing}
            totalSize={totalSize}
          />
        </section>

        <section className="pb-16">
          <ResultsSection
            records={records}
            onDownloadJson={downloadRecordAsJson}
            onDownloadCsv={downloadRecordAsCsv}
          />
        </section>
      </main>

      <AlertStack alerts={alerts} onDismiss={dismissAlert} />
    </div>
  );
}

type UploadSectionProps = {
  documents: UploadDocument[];
  onFileInput: (files: FileList | null) => void;
  onRemove: (id: string) => void;
  onProcess: () => void;
  isProcessing: boolean;
  totalSize: number;
};

function UploadSection({
  documents,
  onFileInput,
  onRemove,
  onProcess,
  isProcessing,
  totalSize,
}: UploadSectionProps) {
  const totalCount = documents.length;

  return (
    <div className="grid gap-6 rounded-2xl border border-dashed border-slate-200 bg-white/70 p-6 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">上传文献</h2>
          <p className="text-sm text-slate-600">
            支持拖拽或点击上传，多文件批量处理。单个文件需为 PDF，大小不超过 20MB。
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="relative inline-flex cursor-pointer items-center rounded-full bg-primary-50 px-4 py-2 text-sm font-medium text-primary-600 shadow-sm transition hover:bg-primary-100">
            <input
              type="file"
              accept="application/pdf"
              multiple
              className="sr-only"
              onChange={(event) => {
                onFileInput(event.target.files);
                event.target.value = "";
              }}
            />
            选择 PDF
          </label>
          <button
            type="button"
            disabled={!totalCount || isProcessing}
            onClick={onProcess}
            className={clsx(
              "inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold text-white shadow-sm transition",
              isProcessing
                ? "bg-slate-400"
                : "bg-primary-600 hover:bg-primary-500",
              (!totalCount || isProcessing) && "cursor-not-allowed opacity-80",
            )}
          >
            {isProcessing ? "处理中..." : "开始提取"}
          </button>
        </div>
      </div>

      <div
        className="flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-8 text-center text-slate-500"
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }}
        onDrop={(event) => {
          event.preventDefault();
          onFileInput(event.dataTransfer.files);
        }}
      >
        <span className="text-lg font-medium text-slate-700">
          拖拽 PDF 文件到此处，或点击上方按钮选择文件
        </span>
        <span className="text-sm text-slate-500">
          已选择 {totalCount} 个文件，总计 {(totalSize / (1024 * 1024)).toFixed(2)} MB
        </span>
      </div>

      {totalCount > 0 && (
        <ul className="grid gap-3">
          {documents.map((doc) => (
            <li
              key={doc.id}
              className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between"
            >
              <div>
                <p className="text-sm font-medium text-slate-900">{doc.fileName}</p>
                <p className="text-xs text-slate-500">
                  {(doc.size / (1024 * 1024)).toFixed(2)} MB · 状态：
                  {statusLabel(doc.status)}
                </p>
                {doc.error && (
                  <p className="mt-1 text-xs text-red-500">{doc.error}</p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <div className="h-2 w-40 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={clsx(
                      "h-full rounded-full transition-all",
                      doc.status === "complete"
                        ? "bg-emerald-500"
                        : doc.status === "error"
                        ? "bg-red-500"
                        : "bg-primary-500",
                    )}
                    style={{ width: `${Math.round(doc.progress * 100)}%` }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(doc.id)}
                  className="text-xs font-medium text-slate-500 transition hover:text-red-500"
                  disabled={isProcessing}
                >
                  移除
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function statusLabel(status: UploadDocument["status"]) {
  switch (status) {
    case "ready":
      return "待提取";
    case "parsing":
      return "解析 PDF";
    case "extracting":
      return "AI 提取";
    case "complete":
      return "已完成";
    case "error":
      return "失败";
    default:
      return "未知";
  }
}

type ResultsSectionProps = {
  records: ExtractionRecord[];
  onDownloadJson: (record: ExtractionRecord) => void;
  onDownloadCsv: (record: ExtractionRecord) => void;
};

function ResultsSection({
  records,
  onDownloadJson,
  onDownloadCsv,
}: ResultsSectionProps) {
  const [activeRecordId, setActiveRecordId] = useState<string | null>(null);

  useEffect(() => {
    if (!records.length) {
      setActiveRecordId(null);
      return;
    }

    if (!activeRecordId || !records.some((record) => record.id === activeRecordId)) {
      setActiveRecordId(records[0]?.id ?? null);
    }
  }, [records, activeRecordId]);

  if (!records.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white/70 p-8 text-center text-slate-500">
        暂无提取结果，上传 PDF 并点击“开始提取”即可查看。
      </div>
    );
  }

  const activeRecord = records.find((record) => record.id === activeRecordId) ?? records[0];

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <aside className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700">历史记录</h3>
        <ul className="mt-3 space-y-2 overflow-y-auto pr-2 text-sm max-h-[420px] scrollbar-thin">
          {records.map((record) => {
            const isActive = record.id === activeRecord.id;
            return (
              <li key={record.id}>
                <button
                  type="button"
                  onClick={() => setActiveRecordId(record.id)}
                  className={clsx(
                    "w-full rounded-xl border px-3 py-2 text-left transition",
                    isActive
                      ? "border-primary-200 bg-primary-50 text-primary-700 shadow-sm"
                      : "border-transparent hover:border-slate-200 hover:bg-slate-50",
                  )}
                >
                  <p className="line-clamp-1 text-sm font-medium">{record.fileName}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {new Date(record.processedAt).toLocaleString()} ·
                    {record.summary.organismCount} 个实体
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      <article className="flex flex-col gap-6 rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              {activeRecord.fileName}
            </h3>
            <p className="text-xs text-slate-500">
              {new Date(activeRecord.processedAt).toLocaleString()} · 耗时
              {(activeRecord.durationMs / 1000).toFixed(1)} 秒 · 文本预览：
              {activeRecord.rawTextPreview.length} 字符
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onDownloadJson(activeRecord)}
              className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-primary-200 hover:text-primary-600"
            >
              导出 JSON
            </button>
            <button
              type="button"
              onClick={() => onDownloadCsv(activeRecord)}
              className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-primary-200 hover:text-primary-600"
            >
              导出 CSV
            </button>
          </div>
        </div>

        <SummaryBadges record={activeRecord} />
        <EntityTable record={activeRecord} />
      </article>
    </div>
  );
}

type SummaryBadgesProps = {
  record: ExtractionRecord;
};

function SummaryBadges({ record }: SummaryBadgesProps) {
  const items = [
    {
      label: "识别实体",
      value: record.summary.organismCount,
      description: "总计识别的微生物相关实体数量",
    },
    {
      label: "唯一物种",
      value: record.summary.uniqueSpecies,
      description: "按属+种去重后的数量",
    },
    {
      label: "抗药性条目",
      value: record.summary.resistanceCount,
      description: "涉及抗药性的描述条目数",
    },
    {
      label: "分离来源",
      value: record.summary.sourceCount,
      description: "包含来源信息的实体数量",
    },
    {
      label: "致病性",
      value: record.summary.pathogenicityCount,
      description: "提供致病性描述的实体数量",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {item.label}
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {item.value}
          </p>
          <p className="mt-1 text-xs text-slate-500">{item.description}</p>
        </div>
      ))}
    </div>
  );
}

type EntityTableProps = {
  record: ExtractionRecord;
};

function EntityTable({ record }: EntityTableProps) {
  if (!record.entities.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-8 text-center text-slate-500">
        AI 未在该文献中识别到微生物相关实体。
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <div className="grid grid-cols-12 bg-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
        <span className="col-span-2">属 / 种</span>
        <span className="col-span-1">亚种</span>
        <span className="col-span-1">血清型</span>
        <span className="col-span-1">菌株</span>
        <span className="col-span-1">MLST</span>
        <span className="col-span-1">Taxonomy ID</span>
        <span className="col-span-2">分离来源</span>
        <span className="col-span-1">抗药性</span>
        <span className="col-span-1">致病性</span>
        <span className="col-span-1">上下文</span>
      </div>
      <div className="divide-y divide-slate-200">
        {record.entities.map((entity) => (
          <div key={entity.id} className="grid grid-cols-12 gap-3 px-4 py-3 text-xs">
            <div className="col-span-2">
              <p className="font-medium text-slate-800">
                {[entity.genus, entity.species].filter(Boolean).join(" ") || "-"}
              </p>
              {entity.confidence != null && (
                <p className="mt-1 text-[10px] text-slate-400">
                  置信度 {(entity.confidence * 100).toFixed(0)}%
                </p>
              )}
            </div>
            <div className="col-span-1">{entity.subspecies ?? "-"}</div>
            <div className="col-span-1">{entity.serovar ?? "-"}</div>
            <div className="col-span-1">{entity.strain ?? "-"}</div>
            <div className="col-span-1">{entity.mlst_st ?? "-"}</div>
            <div className="col-span-1">{entity.taxonomy_id ?? "-"}</div>
            <div className="col-span-2 whitespace-pre-wrap text-slate-700">
              {entity.source ?? "-"}
            </div>
            <div className="col-span-1 whitespace-pre-wrap text-slate-700">
              {entity.resistance?.join("; ") ?? "-"}
            </div>
            <div className="col-span-1 whitespace-pre-wrap text-slate-700">
              {entity.pathogenicity ?? "-"}
            </div>
            <div className="col-span-1">
              {entity.context ? (
                <details className="space-y-1">
                  <summary className="cursor-pointer text-primary-600">查看</summary>
                  <p className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50/80 p-2 text-[11px] text-slate-600">
                    {entity.context}
                  </p>
                </details>
              ) : (
                <span>-</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

type SettingsPanelProps = {
  settings: StoredSettings;
  onChange: (partial: Partial<StoredSettings>) => void;
  onClearRecords: () => void;
};

function SettingsPanel({ settings, onChange, onClearRecords }: SettingsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsExpanded((value) => !value)}
        className="flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-primary-200 hover:text-primary-600"
      >
        {isExpanded ? "收起设置" : "API 设置"}
      </button>

      {isExpanded && (
        <div className="absolute right-0 z-20 mt-3 w-80 rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-xl">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-800">DeepSeek API</p>
            <button
              type="button"
              className="text-xs text-slate-400 transition hover:text-red-500"
              onClick={() => setIsExpanded(false)}
            >
              关闭
            </button>
          </div>

          <label className="mt-3 block text-xs font-medium text-slate-500">
            OpenRouter API Key
            <input
              type="password"
              autoComplete="off"
              placeholder="sk-or-..."
              value={settings.apiKey ?? ""}
              onChange={(event) => onChange({ apiKey: event.target.value.trim() })}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </label>

          <label className="mt-3 block text-xs font-medium text-slate-500">
            模型（可选）
            <input
              type="text"
              placeholder="默认 deepseek/deepseek-chat"
              value={settings.preferredModel ?? ""}
              onChange={(event) => onChange({ preferredModel: event.target.value.trim() })}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </label>

          <p className="mt-4 rounded-lg bg-primary-50 p-3 text-xs text-primary-700">
            API Key 仅保存在浏览器的 localStorage 中，不会上传到服务器。
          </p>

          <button
            type="button"
            onClick={() => onClearRecords()}
            className="mt-3 w-full rounded-full border border-red-200 bg-red-50/80 px-4 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-100"
          >
            清空历史记录
          </button>
        </div>
      )}
    </div>
  );
}

type AlertStackProps = {
  alerts: AlertMessage[];
  onDismiss: (id: string) => void;
};

function AlertStack({ alerts, onDismiss }: AlertStackProps) {
  if (!alerts.length) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex flex-col items-center gap-2 px-4">
      {alerts.slice(-3).map((alert) => (
        <div
          key={alert.id}
          className={clsx(
            "pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl border px-4 py-3 shadow-lg",
            alert.type === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : alert.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-slate-200 bg-white text-slate-700",
          )}
        >
          <div className="flex-1 text-sm">{alert.message}</div>
          <button
            type="button"
            className="text-xs font-medium text-slate-500 hover:text-slate-900"
            onClick={() => onDismiss(alert.id)}
          >
            关闭
          </button>
        </div>
      ))}
    </div>
  );
}
