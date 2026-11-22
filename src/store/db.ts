// IndexedDB 持久化（Dexie）。整個事件狀態以單一快照儲存，斷網、重新整理後可完整恢復。
import Dexie, { type Table } from 'dexie';

export interface SnapshotRow {
  key: string;
  savedAt: number;
  data: unknown;
}

/** 歷史案件：以事件開始時間為鍵，同一案件重複存檔會覆寫 */
export interface ArchiveRow {
  id: string;
  savedAt: number;
  startAt: number;
  endAt: number | null;
  /** 列表顯示：地點、事件類型 */
  title: string;
  /** 傷患總數 */
  total: number;
  data: unknown;
}

class MciDB extends Dexie {
  snapshots!: Table<SnapshotRow, string>;
  archives!: Table<ArchiveRow, string>;
  constructor() {
    super('zhuxian-mci');
    this.version(1).stores({ snapshots: 'key' });
    this.version(2).stores({ snapshots: 'key', archives: 'id, savedAt, startAt' });
  }
}

let db: MciDB | null = null;
function getDb(): MciDB | null {
  if (typeof indexedDB === 'undefined') return null;
  db ??= new MciDB();
  return db;
}

export async function loadSnapshot<T>(key = 'current'): Promise<T | null> {
  try {
    const row = await getDb()?.snapshots.get(key);
    return (row?.data as T) ?? null;
  } catch (e) {
    console.warn('讀取 IndexedDB 失敗', e);
    return null;
  }
}

export async function saveSnapshot(data: unknown, key = 'current'): Promise<void> {
  try {
    await getDb()?.snapshots.put({ key, savedAt: Date.now(), data });
  } catch (e) {
    console.warn('寫入 IndexedDB 失敗', e);
  }
}

export async function putArchive(row: ArchiveRow): Promise<boolean> {
  try {
    const d = getDb();
    if (!d) return false;
    await d.archives.put(row);
    return true;
  } catch (e) {
    console.warn('案件存檔失敗', e);
    return false;
  }
}

/** 歷史案件（新到舊） */
export async function listArchives(): Promise<ArchiveRow[]> {
  try {
    return (await getDb()?.archives.orderBy('startAt').reverse().toArray()) ?? [];
  } catch (e) {
    console.warn('讀取歷史案件失敗', e);
    return [];
  }
}

export async function getArchive(id: string): Promise<ArchiveRow | null> {
  try {
    return (await getDb()?.archives.get(id)) ?? null;
  } catch {
    return null;
  }
}

export async function deleteArchive(id: string): Promise<void> {
  try {
    await getDb()?.archives.delete(id);
  } catch (e) {
    console.warn('刪除歷史案件失敗', e);
  }
}

const SETTINGS_KEY = 'zhuxian-mci-settings';
export function loadSettingsPref<T>(): Partial<T> {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}');
  } catch {
    return {};
  }
}
export function saveSettingsPref(s: unknown) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* 忽略 */
  }
}
