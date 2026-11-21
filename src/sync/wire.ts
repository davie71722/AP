// 多人同步：資料以「單一病人／車輛／醫院／事件欄位」為單位，各自帶最後修改時間，
// 合併時取較新者（Last-Write-Wins）。紀錄（案件經過）只會新增，取聯集。
import type { Color, HospitalRuntime, Incident, LogEntry, Patient, Vehicle } from '../types';

export interface Stamped<T> {
  /** 最後修改時間（ms） */
  u: number;
  /** 修改的裝置 */
  d?: string;
  /** null = 已刪除 */
  v: T | null;
}

export const INCIDENT_FIELDS = ['types', 'location', 'startAt', 'settings', 'milestones'] as const;
export type IncidentField = (typeof INCIDENT_FIELDS)[number];

export interface Wire {
  patients: Record<string, Stamped<Patient>>;
  vehicles: Record<string, Stamped<Vehicle>>;
  runtime: Record<string, Stamped<HospitalRuntime>>;
  incident: Partial<Record<IncidentField, Stamped<unknown>>>;
  log: Record<string, LogEntry>;
  counters: Record<Color, number>;
  seq: number;
}

/** 本機的共享資料 */
export interface Shared {
  incident: Incident;
  patients: Patient[];
  vehicles: Vehicle[];
  runtime: Record<string, HospitalRuntime>;
  counters: Record<Color, number>;
  seq: number;
}

export interface Changes {
  patients: Record<string, Stamped<Patient>>;
  vehicles: Record<string, Stamped<Vehicle>>;
  runtime: Record<string, Stamped<HospitalRuntime>>;
  incident: Partial<Record<IncidentField, Stamped<unknown>>>;
  log: Record<string, LogEntry>;
  counters: Record<Color, number>;
  seq: number;
}

export function emptyWire(): Wire {
  return { patients: {}, vehicles: {}, runtime: {}, incident: {}, log: {}, counters: { R: 0, Y: 0, G: 0, K: 0 }, seq: 0 };
}

export function logKey(l: LogEntry): string {
  let h = 0;
  for (let i = 0; i < l.text.length; i++) h = (h * 31 + l.text.charCodeAt(i)) | 0;
  return `${l.at}:${(h >>> 0).toString(36)}`;
}

export function hasChanges(c: Changes): boolean {
  return (
    Object.keys(c.patients).length + Object.keys(c.vehicles).length + Object.keys(c.runtime).length + Object.keys(c.incident).length + Object.keys(c.log).length >
    0
  );
}

const newer = <T>(a: Stamped<T> | undefined, b: Stamped<T>) => !a || b.u > a.u || (b.u === a.u && (b.d ?? '') > (a.d ?? ''));

/** 把本機變更合併進伺服器狀態（不修改原物件） */
export function applyChanges(w: Wire, c: Changes): Wire {
  const out: Wire = {
    patients: { ...w.patients },
    vehicles: { ...w.vehicles },
    runtime: { ...w.runtime },
    incident: { ...w.incident },
    log: { ...w.log, ...c.log },
    counters: { ...w.counters },
    seq: Math.max(w.seq, c.seq),
  };
  for (const [k, s] of Object.entries(c.patients)) if (newer(out.patients[k], s)) out.patients[k] = s;
  for (const [k, s] of Object.entries(c.vehicles)) if (newer(out.vehicles[k], s)) out.vehicles[k] = s;
  for (const [k, s] of Object.entries(c.runtime)) if (newer(out.runtime[k], s)) out.runtime[k] = s;
  for (const [k, s] of Object.entries(c.incident) as [IncidentField, Stamped<unknown>][]) if (newer(out.incident[k], s)) out.incident[k] = s;
  for (const k of Object.keys(c.counters) as Color[]) out.counters[k] = Math.max(out.counters[k] ?? 0, c.counters[k] ?? 0);
  return out;
}

/** 追蹤本機已同步的物件參照，用來找出本機改了哪些 */
export class Tracker {
  /** key → 上次同步時的物件參照與時間 */
  refs = new Map<string, { ref: unknown; u: number }>();
  logs = new Set<string>();

  constructor(public device: string) {}

  /** 找出自上次同步後本機的變更 */
  collect(s: Shared, now: number): Changes {
    const c: Changes = { patients: {}, vehicles: {}, runtime: {}, incident: {}, log: {}, counters: { ...s.counters }, seq: s.seq };
    const d = this.device;
    const seen = new Set<string>();
    for (const p of s.patients) {
      const k = `p:${p.id}`;
      seen.add(k);
      if (this.refs.get(k)?.ref !== p) c.patients[p.id] = { u: now, d, v: p };
    }
    for (const v of s.vehicles) {
      const k = `v:${v.id}`;
      seen.add(k);
      if (this.refs.get(k)?.ref !== v) c.vehicles[v.id] = { u: now, d, v };
    }
    for (const [hid, r] of Object.entries(s.runtime)) {
      const k = `r:${hid}`;
      seen.add(k);
      if (this.refs.get(k)?.ref !== r) c.runtime[hid] = { u: now, d, v: r };
    }
    for (const f of INCIDENT_FIELDS) {
      const k = `i:${f}`;
      seen.add(k);
      const val = s.incident[f] ?? null;
      const prev = this.refs.get(k);
      if (!prev || (prev.ref !== val && JSON.stringify(prev.ref) !== JSON.stringify(val))) c.incident[f] = { u: now, d, v: val };
    }
    // 刪除
    for (const [k, r] of this.refs) {
      if (seen.has(k) || r.ref === null) continue;
      const id = k.slice(2);
      if (k.startsWith('p:')) c.patients[id] = { u: now, d, v: null };
      else if (k.startsWith('v:')) c.vehicles[id] = { u: now, d, v: null };
    }
    for (const l of s.incident.log) {
      const k = logKey(l);
      if (!this.logs.has(k)) c.log[k] = l;
    }
    return c;
  }

  /**
   * 採用伺服器狀態。sent 為本次送出的變更：送出後本機又改過的物件保留本機版本（下次再送）。
   * 回傳新的本機共享資料。
   */
  adopt(local: Shared, w: Wire, pending: Changes, replace = false): Shared {
    if (replace) {
      this.refs.clear();
      this.logs.clear();
      local = { ...local, patients: [], vehicles: [], incident: { ...local.incident, log: [] } };
    }
    const keepLocal = (k: string, ref: unknown) => {
      if (replace) return false;
      const r = this.refs.get(k);
      // 本機在送出後又修改（參照不同於已記錄、也不同於剛送出的版本）
      return r?.ref !== ref && !isPending(pending, k, ref);
    };

    const localP = new Map(local.patients.map((p) => [p.id, p]));
    const patients: Patient[] = [];
    const ids = new Set([...Object.keys(w.patients), ...localP.keys()]);
    for (const id of ids) {
      const k = `p:${id}`;
      const lp = localP.get(id);
      const s = w.patients[id];
      if (lp && keepLocal(k, lp)) {
        patients.push(lp);
        continue;
      }
      if (!s) {
        // 伺服器沒有、本機有：尚未送出的新增，保留
        if (lp) patients.push(lp);
        continue;
      }
      if (s.v === null) {
        this.refs.set(k, { ref: null, u: s.u });
        continue;
      }
      const prev = this.refs.get(k);
      const use = lp && prev && prev.u === s.u && lp === prev.ref ? lp : s.v;
      this.refs.set(k, { ref: use, u: s.u });
      patients.push(use);
    }
    patients.sort((a, b) => (a.history[0]?.at ?? 0) - (b.history[0]?.at ?? 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

    const localV = new Map(local.vehicles.map((v) => [v.id, v]));
    const vehicles: Vehicle[] = [];
    for (const id of new Set([...Object.keys(w.vehicles), ...localV.keys()])) {
      const k = `v:${id}`;
      const lv = localV.get(id);
      const s = w.vehicles[id];
      if (lv && keepLocal(k, lv)) {
        vehicles.push(lv);
        continue;
      }
      if (!s) {
        if (lv) vehicles.push(lv);
        continue;
      }
      if (s.v === null) {
        this.refs.set(k, { ref: null, u: s.u });
        continue;
      }
      const prev = this.refs.get(k);
      const use = lv && prev && prev.u === s.u && lv === prev.ref ? lv : s.v;
      this.refs.set(k, { ref: use, u: s.u });
      vehicles.push(use);
    }
    vehicles.sort((a, b) => a.addedAt - b.addedAt);

    const runtime: Record<string, HospitalRuntime> = { ...local.runtime };
    for (const [hid, s] of Object.entries(w.runtime)) {
      const k = `r:${hid}`;
      if (s.v === null) continue;
      if (local.runtime[hid] && keepLocal(k, local.runtime[hid])) continue;
      const prev = this.refs.get(k);
      const use = prev && prev.u === s.u && local.runtime[hid] === prev.ref ? local.runtime[hid] : s.v;
      runtime[hid] = use;
      this.refs.set(k, { ref: use, u: s.u });
    }

    const incident: Incident = { ...local.incident };
    for (const f of INCIDENT_FIELDS) {
      const k = `i:${f}`;
      const s = w.incident[f];
      const lv = local.incident[f] ?? null;
      if (!s) continue;
      const r = this.refs.get(k);
      const localEdit = !replace && JSON.stringify(r ? r.ref ?? null : undefined) !== JSON.stringify(lv) && !isPending(pending, k, lv);
      if (localEdit) continue;
      const val = JSON.stringify(lv) === JSON.stringify(s.v) ? lv : s.v;
      (incident as unknown as Record<string, unknown>)[f] = val ?? (f === 'types' ? [] : f === 'startAt' || f === 'location' ? null : undefined);
      this.refs.set(k, { ref: val, u: s.u });
    }
    // 紀錄：聯集
    const logMap = new Map<string, LogEntry>();
    for (const l of local.incident.log) logMap.set(logKey(l), l);
    for (const [k, l] of Object.entries(w.log)) {
      if (!logMap.has(k)) logMap.set(k, l);
      this.logs.add(k);
    }
    for (const k of Object.keys(pending.log)) this.logs.add(k);
    incident.log = [...logMap.values()].sort((a, b) => a.at - b.at);

    const counters = { ...local.counters };
    for (const c of Object.keys(w.counters) as Color[]) counters[c] = Math.max(counters[c] ?? 0, w.counters[c] ?? 0);
    return { incident, patients, vehicles, runtime, counters, seq: Math.max(local.seq, w.seq) };
  }

  /** 送出成功：記錄這批物件為已同步 */
  markSent(c: Changes) {
    for (const [id, s] of Object.entries(c.patients)) this.refs.set(`p:${id}`, { ref: s.v, u: s.u });
    for (const [id, s] of Object.entries(c.vehicles)) this.refs.set(`v:${id}`, { ref: s.v, u: s.u });
    for (const [id, s] of Object.entries(c.runtime)) this.refs.set(`r:${id}`, { ref: s.v, u: s.u });
    for (const [f, s] of Object.entries(c.incident)) this.refs.set(`i:${f}`, { ref: s!.v, u: s!.u });
    for (const k of Object.keys(c.log)) this.logs.add(k);
  }
}

function isPending(c: Changes, k: string, ref: unknown): boolean {
  const id = k.slice(2);
  if (k.startsWith('p:')) return c.patients[id]?.v === ref;
  if (k.startsWith('v:')) return c.vehicles[id]?.v === ref;
  if (k.startsWith('r:')) return c.runtime[id]?.v === ref;
  if (k.startsWith('i:')) return JSON.stringify(c.incident[id as IncidentField]?.v ?? null) === JSON.stringify(ref ?? null);
  return false;
}

/** 兩人同時新增造成重複代碼（如兩個紅3）：較晚建立者改用下一個號碼（各裝置算法一致） */
export function dedupeLabels(patients: Patient[], counters: Record<Color, number>): { patients: Patient[]; counters: Record<Color, number>; changed: boolean } {
  const seen = new Map<string, Patient>();
  const sorted = [...patients].sort((a, b) => (a.history[0]?.at ?? 0) - (b.history[0]?.at ?? 0) || (a.id < b.id ? -1 : 1));
  const renum = new Map<string, number>();
  const next = { ...counters };
  for (const c of ['R', 'Y', 'G', 'K'] as Color[]) next[c] = Math.max(next[c] ?? 0, ...patients.filter((p) => p.color === c).map((p) => p.num));
  for (const p of sorted) {
    const k = `${p.color}${p.num}`;
    if (!seen.has(k)) {
      seen.set(k, p);
      continue;
    }
    next[p.color] += 1;
    renum.set(p.id, next[p.color]);
  }
  if (!renum.size) return { patients, counters, changed: false };
  return { patients: patients.map((p) => (renum.has(p.id) ? { ...p, num: renum.get(p.id)! } : p)), counters: next, changed: true };
}
