// 交接 QR Code 與多人即時同步（GAS 後端；每 3 秒同步一次，本機修改後 0.4 秒內送出）
import { create } from 'zustand';
import { callMapService, mapServiceConfigured } from '../travel/routes';
import { offlineTravelState } from '../travel';
import { locKey, setReadOnly, useStore } from '../store/store';
import { patientLabel } from '../types';
import { applyChanges, dedupeLabels, emptyWire, hasChanges, Tracker, type Changes, type Shared, type Wire } from './wire';

export type Role = 'edit' | 'view';

interface SyncState {
  room: string | null;
  key: string | null;
  role: Role | null;
  url: string;
  keys: { editKey?: string; viewKey?: string };
  lastOk: number | null;
  error: string | null;
  busy: boolean;
}

export const useSync = create<SyncState>(() => ({
  room: null,
  key: null,
  role: null,
  url: '',
  keys: {},
  lastOk: null,
  error: null,
  busy: false,
}));

const SAVE_KEY = 'zhuxian-mci-sync';
const POLL_MS = 3000;

function deviceId(): string {
  try {
    let d = localStorage.getItem('zhuxian-mci-device');
    if (!d) {
      d = Math.random().toString(36).slice(2, 10);
      localStorage.setItem('zhuxian-mci-device', d);
    }
    return d;
  } catch {
    return Math.random().toString(36).slice(2, 10);
  }
}

let tracker = new Tracker(deviceId());
let server: Wire = emptyWire();
let rev = 0;
let timer: ReturnType<typeof setInterval> | null = null;
let kick: ReturnType<typeof setTimeout> | null = null;
let running = false;

const noChanges = (): Changes => ({ patients: {}, vehicles: {}, runtime: {}, incident: {}, log: {}, counters: { R: 0, Y: 0, G: 0, K: 0 }, seq: 0 });

export function syncAvailable(): boolean {
  return mapServiceConfigured();
}

function shared(): Shared {
  const s = useStore.getState();
  return { incident: s.incident, patients: s.patients, vehicles: s.vehicles, runtime: s.runtime, counters: s.counters, seq: s.seq };
}

/** 寫入本機（同時處理重複代碼與地點變更） */
function applyLocal(sh: Shared) {
  const before = useStore.getState();
  const dd = dedupeLabels(sh.patients, sh.counters);
  let patients = sh.patients;
  let counters = sh.counters;
  if (dd.changed) {
    const sys = sh.incident.settings.triageSystem;
    patients = dd.patients.map((p) => {
      const label = patientLabel(p.color, p.num, p.redClass, sys);
      return label === p.label ? p : { ...p, label };
    });
    counters = dd.counters;
  }
  const locChanged =
    sh.incident.location && (!before.incident.location || locKey(sh.incident.location) !== locKey(before.incident.location));
  useStore.setState({
    incident: sh.incident,
    patients,
    vehicles: sh.vehicles,
    runtime: sh.runtime,
    counters,
    seq: sh.seq,
    ...(locChanged ? { travel: offlineTravelState(sh.incident.location!, Date.now()) } : {}),
  });
  if (locChanged) void useStore.getState().refreshTravel(true);
  if (sh.incident.startAt && before.tab === 'incident' && !before.incident.startAt) useStore.setState({ tab: 'scene' });
}

async function call<T>(body: Record<string, unknown>): Promise<T> {
  return callMapService<T>(body);
}

function save() {
  const { room, key } = useSync.getState();
  try {
    if (room && key) localStorage.setItem(SAVE_KEY, JSON.stringify({ room, key }));
    else localStorage.removeItem(SAVE_KEY);
  } catch {
    /* 忽略 */
  }
}

function startLoop() {
  if (timer) return;
  timer = setInterval(() => void tick(), POLL_MS);
  void tick();
}

/** 本機一有修改就盡快送出 */
useStore.subscribe((s, p) => {
  if (!useSync.getState().room || useSync.getState().role !== 'edit') return;
  if (s.patients === p.patients && s.vehicles === p.vehicles && s.runtime === p.runtime && s.incident === p.incident) return;
  if (kick) clearTimeout(kick);
  kick = setTimeout(() => void tick(), 400);
});

async function tick() {
  const st = useSync.getState();
  if (running || !st.room || !st.key) return;
  if (typeof document !== 'undefined' && document.hidden && st.role === 'view') return;
  running = true;
  useSync.setState({ busy: true });
  try {
    const c = tracker.collect(shared(), Date.now());
    if (st.role === 'edit' && hasChanges(c)) {
      for (let attempt = 0; attempt < 4; attempt++) {
        const next = applyChanges(server, c);
        const r = await call<{ rev: number; conflict?: boolean; state?: Wire }>({ sync: 'put', room: st.room, key: st.key, rev, state: next });
        if (r.conflict && r.state) {
          server = r.state;
          rev = r.rev;
          continue;
        }
        rev = r.rev;
        server = next;
        tracker.markSent(c);
        applyLocal(tracker.adopt(shared(), server, c));
        break;
      }
    } else {
      const r = await call<{ rev: number; role: Role; url?: string; keys?: SyncState['keys']; state?: Wire }>({
        sync: 'get',
        room: st.room,
        key: st.key,
        rev,
      });
      if (r.role !== st.role) setRole(r.role);
      if (r.url || r.keys) useSync.setState({ url: r.url || st.url, keys: r.keys ?? st.keys });
      if (r.state) {
        server = r.state;
        rev = r.rev;
        applyLocal(tracker.adopt(shared(), server, noChanges()));
      }
    }
    useSync.setState({ lastOk: Date.now(), error: null });
  } catch (e) {
    const msg = String((e as Error)?.message ?? e);
    useSync.setState({ error: msg === 'room_not_found' ? '共享已失效（超過 6 小時無人使用）' : msg === 'bad_key' ? '交接碼錯誤' : msg });
    if (msg === 'room_not_found' || msg === 'bad_key') leave();
  } finally {
    running = false;
    useSync.setState({ busy: false });
  }
}

function setRole(role: Role) {
  useSync.setState({ role });
  setReadOnly(role === 'view');
}

/** 產生交接：建立共享，回傳房號 */
export async function startShare(): Promise<void> {
  if (useSync.getState().room) return;
  tracker = new Tracker(deviceId());
  const c = tracker.collect(shared(), Date.now());
  const wire = applyChanges(emptyWire(), c);
  const r = await call<{ room: string; editKey: string; viewKey: string; rev: number; url: string }>({ sync: 'create', state: wire });
  tracker.markSent(c);
  server = wire;
  rev = r.rev;
  useSync.setState({ room: r.room, key: r.editKey, url: r.url, keys: { editKey: r.editKey, viewKey: r.viewKey }, error: null, lastOk: Date.now() });
  setRole('edit');
  save();
  startLoop();
}

/** 掃描 QR 後加入（以共享資料取代本機） */
export async function join(room: string, key: string): Promise<void> {
  const r = await call<{ rev: number; role: Role; url: string; keys?: SyncState['keys']; state: Wire }>({ sync: 'get', room, key, rev: -1 });
  tracker = new Tracker(deviceId());
  server = r.state ?? emptyWire();
  rev = r.rev;
  useSync.setState({ room, key, url: r.url, keys: r.keys ?? {}, error: null, lastOk: Date.now() });
  setRole(r.role);
  applyLocal(tracker.adopt(shared(), server, noChanges(), true));
  save();
  startLoop();
}

/** 離開共享（本機保留目前資料） */
export function leave() {
  if (timer) clearInterval(timer);
  timer = null;
  useSync.setState({ room: null, key: null, role: null, keys: {}, url: '' });
  setReadOnly(false);
  save();
}

export function shareUrl(mode: Role): string {
  const { url, room, keys } = useSync.getState();
  const key = mode === 'edit' ? keys.editKey : keys.viewKey;
  if (!room || !key) return '';
  const base = url || (typeof location !== 'undefined' ? location.href.split('?')[0] : '');
  return `${base}?room=${room}&k=${key}`;
}

/** 讀取網址參數（GAS 網頁在 iframe 中，需透過 google.script.url） */
function readParams(): Promise<Record<string, string>> {
  type GUrl = { getLocation(cb: (l: { parameter: Record<string, string> }) => void): void };
  const g = (globalThis as unknown as { google?: { script?: { url?: GUrl } } }).google;
  if (g?.script?.url) return new Promise((res) => g.script!.url!.getLocation((l) => res(l.parameter ?? {})));
  const p: Record<string, string> = {};
  if (typeof location !== 'undefined') new URLSearchParams(location.search).forEach((v, k) => (p[k] = v));
  return Promise.resolve(p);
}

/** 開啟時：網址帶交接碼則加入；否則恢復上次的共享 */
export async function bootSync(confirmReplace: () => boolean): Promise<void> {
  if (!syncAvailable()) return;
  const p = await readParams();
  let saved: { room?: string; key?: string } = {};
  try {
    saved = JSON.parse(localStorage.getItem(SAVE_KEY) ?? '{}');
  } catch {
    /* 忽略 */
  }
  try {
    if (p.room && p.k) {
      const same = saved.room === p.room && saved.key === p.k;
      const s = useStore.getState();
      const hasLocal = !!s.incident.startAt && s.patients.length + s.vehicles.length > 0;
      if (!same && hasLocal && saved.room !== p.room && !confirmReplace()) return;
      await join(p.room, p.k);
    } else if (saved.room && saved.key) {
      await join(saved.room, saved.key);
    }
  } catch (e) {
    useSync.setState({ error: String((e as Error)?.message ?? e) });
    if (/room_not_found|bad_key/.test(String((e as Error)?.message))) {
      try {
        localStorage.removeItem(SAVE_KEY);
      } catch {
        /* 忽略 */
      }
    }
  }
}

// 測試用
export const __test = { tick, reset: () => ((tracker = new Tracker('t')), (server = emptyWire()), (rev = 0), leave()) };
