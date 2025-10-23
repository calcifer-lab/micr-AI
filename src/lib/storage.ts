import type { ExtractionRecord, StoredSettings } from "@/types/extraction";

const RECORDS_KEY = "micr-ai:records";
const SETTINGS_KEY = "micr-ai:settings";

export function loadStoredRecords(): ExtractionRecord[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(RECORDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ExtractionRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("无法读取本地缓存的提取结果", error);
    return [];
  }
}

export function persistRecords(records: ExtractionRecord[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
  } catch (error) {
    console.error("无法保存提取结果到本地缓存", error);
  }
}

export function loadSettings(): StoredSettings {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as StoredSettings;
    return parsed ?? {};
  } catch (error) {
    console.error("无法读取设置", error);
    return {};
  }
}

export function persistSettings(settings: StoredSettings) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error("无法保存设置", error);
  }
}
