export type ExtractionPhase =
  | "ready"
  | "parsing"
  | "extracting"
  | "complete"
  | "error";

export interface MicrobialEntity {
  id: string;
  genus?: string | null;
  species?: string | null;
  subspecies?: string | null;
  serovar?: string | null;
  strain?: string | null;
  mlst_st?: string | null;
  taxonomy_id?: string | null;
  source?: string | null;
  resistance?: string[];
  pathogenicity?: string | null;
  context?: string | null;
  confidence?: number | null;
}

export interface ExtractionSummary {
  organismCount: number;
  uniqueSpecies: number;
  resistanceCount: number;
  sourceCount: number;
  pathogenicityCount: number;
  keyFindings: string[];
}

export interface ExtractionRecord {
  id: string;
  fileName: string;
  fileSize: number;
  processedAt: string;
  durationMs: number;
  summary: ExtractionSummary;
  entities: MicrobialEntity[];
  rawTextPreview: string;
}

export interface UploadDocument {
  id: string;
  file: File;
  fileName: string;
  size: number;
  addedAt: number;
  status: ExtractionPhase;
  progress: number;
  error?: string;
  record?: ExtractionRecord;
}

export interface StoredSettings {
  apiKey?: string;
  preferredModel?: string;
}
