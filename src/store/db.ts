// IndexedDB 持久化（Dexie）。整個事件狀態以單一快照儲存，斷網、重新整理後可完整恢復。
import Dexie, { type Table } from 'dexie';

export interface SnapshotRow {
  key: string;
  savedAt: number;
  data: unknown;
}

class MciDB extends Dexie {
  snapshots!: Table<SnapshotRow, string>;
  constructor() {
    super('zhuxian-mci');
    this.version(1).stores({ snapshots: 'key' });
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
