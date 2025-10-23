import type { ExtractionRecord } from "@/types/extraction";

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function downloadRecordAsJson(record: ExtractionRecord) {
  const blob = new Blob([JSON.stringify(record, null, 2)], {
    type: "application/json",
  });
  downloadBlob(blob, `${record.fileName.replace(/\\.pdf$/i, "")}-micr-ai.json`);
}

export function downloadRecordAsCsv(record: ExtractionRecord) {
  const headers = [
    "genus",
    "species",
    "subspecies",
    "serovar",
    "strain",
    "mlst_st",
    "taxonomy_id",
    "source",
    "resistance",
    "pathogenicity",
    "context",
    "confidence",
  ];

  const rows = record.entities.map((entity) =>
    headers
      .map((header) => {
        const value = (entity as Record<string, unknown>)[header];
        if (Array.isArray(value)) {
          return `"${value.join("; ").replace(/"/g, '""')}"`;
        }
        if (value == null) {
          return "";
        }
        const str = String(value).replace(/"/g, '""');
        return str.includes(",") || str.includes("\n")
          ? `"${str}"`
          : str;
      })
      .join(","),
  );

  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, `${record.fileName.replace(/\\.pdf$/i, "")}-micr-ai.csv`);
}
