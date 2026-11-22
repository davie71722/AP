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

/** 個案照片（只存在本機，不同步；以 JPEG dataURL 儲存） */
export interface PhotoRow {
  id: string;
  patientId: string;
  at: number;
  dataUrl: string;
  /** 照片一／照片二（舊資料依時間排序補上） */
  slot?: number;
}
export const MAX_PHOTOS = 2;

/** 合成照片：每位病人一張，隨案件保存（照片或病人資訊變動時自動重新合成） */
export interface CompositeRow {
  patientId: string;
  at: number;
  /** 合成依據（照片與資訊欄內容）；相同則不重做 */
  key: string;
  dataUrl: string;
}

class MciDB extends Dexie {
  snapshots!: Table<SnapshotRow, string>;
  archives!: Table<ArchiveRow, string>;
  photos!: Table<PhotoRow, string>;
  composites!: Table<CompositeRow, string>;
  constructor() {
    super('zhuxian-mci');
    this.version(1).stores({ snapshots: 'key' });
    this.version(2).stores({ snapshots: 'key', archives: 'id, savedAt, startAt' });
    this.version(3).stores({ snapshots: 'key', archives: 'id, savedAt, startAt', photos: 'id, patientId' });
    this.version(4).stores({ snapshots: 'key', archives: 'id, savedAt, startAt', photos: 'id, patientId', composites: 'patientId' });
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
    // 一併刪除該案件病人的照片
    const row = await getDb()?.archives.get(id);
    const ids = ((row?.data as { patients?: { id: string }[] } | undefined)?.patients ?? []).map((p) => p.id);
    if (ids.length) await getDb()?.photos.where('patientId').anyOf(ids).delete();
    if (ids.length) await getDb()?.composites.bulkDelete(ids);
    await getDb()?.archives.delete(id);
  } catch (e) {
    console.warn('刪除歷史案件失敗', e);
  }
}

/** 某病人的照片，依照片一、照片二排序 */
export async function listPhotos(patientId: string): Promise<PhotoRow[]> {
  try {
    const rows = ((await getDb()?.photos.where('patientId').equals(patientId).toArray()) ?? []).sort((a, b) => a.at - b.at);
    return rows.map((r, i) => ({ ...r, slot: r.slot ?? i + 1 })).sort((a, b) => a.slot! - b.slot!);
  } catch {
    return [];
  }
}

/** 放入照片一／照片二（同格重拍會取代）；未指定則放第一個空格，已滿回傳 false */
export async function addPhoto(patientId: string, dataUrl: string, slot?: number): Promise<boolean> {
  const d = getDb();
  if (!d) return false;
  try {
    const rows = await listPhotos(patientId);
    const s = slot ?? [1, 2].find((x) => !rows.some((r) => r.slot === x));
    if (!s || s < 1 || s > MAX_PHOTOS) return false;
    for (const r of rows.filter((r) => r.slot === s)) await d.photos.delete(r.id);
    await d.photos.put({ id: `${patientId}-s${s}`, patientId, at: Date.now(), dataUrl, slot: s });
    return true;
  } catch (e) {
    console.warn('照片儲存失敗', e);
    return false;
  }
}

export async function deletePhoto(id: string): Promise<void> {
  try {
    await getDb()?.photos.delete(id);
  } catch {
    /* 忽略 */
  }
}

export async function getComposite(patientId: string): Promise<CompositeRow | null> {
  try {
    return (await getDb()?.composites.get(patientId)) ?? null;
  } catch {
    return null;
  }
}

/** 多位病人的合成照片（依傳入順序，沒有的略過） */
export async function listComposites(patientIds: string[]): Promise<CompositeRow[]> {
  try {
    const rows = (await getDb()?.composites.bulkGet(patientIds)) ?? [];
    return rows.filter((r): r is CompositeRow => !!r);
  } catch {
    return [];
  }
}

export async function putComposite(row: CompositeRow): Promise<void> {
  try {
    await getDb()?.composites.put(row);
  } catch (e) {
    console.warn('合成照片儲存失敗', e);
  }
}

export async function deleteComposite(patientId: string): Promise<void> {
  try {
    await getDb()?.composites.delete(patientId);
  } catch {
    /* 忽略 */
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
