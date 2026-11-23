import { create } from 'zustand';
import { HOSPITAL_BY_ID, HOSPITALS, initialRuntimes } from '../data/hospitals';
import { FIRE_UNITS, locate, SUPPORT_SOURCES, unitCoord } from '../data/places';
import { INCIDENT_TYPE_BY_ID } from '../data/incidentTypes';
import {
  confirmDispatch,
  dutyTransport as dutyTransportDomain,
  hazmatNotifyList,
  setLeft as setLeftDomain,
  setTrapped as setTrappedDomain,
  setPolice as setPoliceDomain,
  setVehicleStatus,
  fmtClock,
  type DomainState,
} from '../engine/actions';
import { effectiveCap, effectiveTravel } from '../engine/plan';
import { missingRequirements } from '../engine/rules';
import type { Suggestion } from '../engine/plan';
import { combineRules } from '../engine/rules';
import { etaFromPoint, etaFromUnit, offlineTravelState } from '../travel';
import { fetchOnlineTravel, routesEnabled } from '../travel/routes';
import { timeFactor } from '../travel/traffic';
import { haversineKm } from '../travel/offline';
import {
  TRIAGE_NAMES,
  holdUnlocked,
  patientLabel,
  type RedClass,
  type TriageSystem,
  DEFAULT_SETTINGS,
  PATIENT_TAGS,
  type Color,
  type HospitalRuntime,
  type Incident,
  type IncidentLocation,
  type LogEntry,
  type Patient,
  type Personal,
  type Settings,
  type TransportColor,
  type TravelState,
  type Vehicle,
  type VehicleStatus,
  type Wound,
} from '../types';
import { keepForColor, type TraumaEntry } from '../data/trauma';
import { audit, operatorName } from '../security/consent';
import { deleteDrillArchives, deletePatientMedia, getArchive, loadSettingsPref, loadSnapshot, putArchive, saveSettingsPref, saveSnapshot, type ArchiveRow } from './db';

export type Tab = 'incident' | 'scene' | 'progress' | 'report';
export type Theme = 'day' | 'night';

const THEME_KEY = 'zhuxian-mci-theme';
function loadTheme(): Theme {
  try {
    const t = localStorage.getItem(THEME_KEY);
    if (t === 'day' || t === 'night') return t;
  } catch {
    /* 忽略 */
  }
  return 'night';
}

export interface Persisted {
  incident: Incident;
  patients: Patient[];
  vehicles: Vehicle[];
  runtime: Record<string, HospitalRuntime>;
  travel: TravelState;
  counters: Record<Color, number>;
  seq: number;
  undoStack: { label: string; state: DomainState }[];
}

interface Store extends Persisted {
  hydrated: boolean;
  theme: Theme;
  setTheme(t: Theme): void;
  adjustCrew(id: string, kind: 'emt2' | 'emtp', delta: number): void;
  tab: Tab;
  now: number;
  online: boolean;
  setTab(t: Tab): void;
  /** 指揮節點：大隊抵達等時間戳記 */
  markMilestone(name: string): void;
  /** 案件結束／重新開啟 */
  endIncident(): void;
  reopenIncident(): void;
  tick(): void;
  hydrate(): Promise<void>;

  toggleType(id: string): void;
  setLocation(loc: IncidentLocation): void;
  startIncident(goToInput?: boolean): void;
  updateSettings(p: Partial<Settings>): void;
  clearIncident(): void;
  /** 存檔目前案件到歷史案件（同一案件覆寫）；回傳是否成功 */
  archiveCurrent(): Promise<boolean>;
  /** 最後存檔時間（本次開啟期間） */
  archivedAt: number | null;
  /** 歷史案件清單版本（存檔／刪除後遞增，讓清單重新讀取） */
  archiveRev: number;
  bumpArchives(): void;
  /** 刪除所有演練案件：歷史中的演練案件，及目前案件若為演練則一併清除（不存檔）；回傳刪除件數 */
  deleteAllDrills(): Promise<number>;
  /** 載入歷史案件為目前案件（先存檔目前案件） */
  loadArchive(id: string): Promise<boolean>;

  addPatient(c: Color, redClass?: RedClass): void;
  removeLastPatient(c: Color): void;
  toggleTag(id: string, tag: string): void;
  retriage(id: string, c: Color, redClass?: RedClass): void;
  setRedClass(id: string, cls: RedClass): void;
  setTriageTagNo(id: string, no: string): void;
  /** 個案備註（姓名、年齡、性別、電話、拍拍尺號碼） */
  setPersonal(id: string, p: Partial<Personal>): void;
  /** 照片變動版本（重新讀取縮圖） */
  photoRev: number;
  bumpPhotos(): void;
  /** 合成照片版本（背景重新合成後遞增） */
  compositeRev: number;
  bumpComposites(): void;
  setPatientNote(id: string, note: string): void;
  setWounds(id: string, wounds: Wound[]): void;
  setTrauma(id: string, trauma: TraumaEntry[]): void;
  /** 加入已到場的救護車：分隊、車號、TP／T2 人數 */
  addVehicle(unit: string, num: number, tp: number, t2: number): void;
  /** 後送官自選：病人、車輛、醫院 → 出發 */
  dispatchManual(patientIds: string[], vehicleId: string, hospitalId: string): void;
  deletePatient(id: string): void;

  addUnitVehicle(unit: string): void;
  addSupportVehicle(name: string): void;
  setVehicleStatus(id: string, s: VehicleStatus): void;
  releaseHold(id: string): void;
  setHold(id: string, on: boolean): void;
  arriveAndConfirm(s: Suggestion): void;
  groupTransport(hid: string): void;
  adjustEta(id: string, delta: number): void;
  deleteVehicle(id: string): void;

  adjustSelfPresented(hid: string, c: TransportColor, delta: number): void;
  toggleBypass(hid: string): void;
  setStrain(hid: string, level: 0 | 1 | 2): void;
  setLeft(id: string, left: boolean): void;
  /** 受困中／已脫困 */
  setTrapped(id: string, trapped: boolean): void;
  /** 正式勤務／演練測試 */
  setDrill(drill: boolean): void;
  /** 黑牌：已移交警方／改回待警察接管 */
  setPolice(id: string, handed: boolean): void;
  /** 黑牌暫置區位置、看守人員（輸入中不記錄） */
  setMorgue(p: { location?: string; guard?: string }): void;
  /** 黑牌暫置區資料寫入案件經過（輸入完成時） */
  logMorgue(): void;
  dutyTransport(id: string, hid: string | undefined): void;
  /** 綠牌由其他車輛（勤務車、民間救護車、巴士）後送；一筆撤銷 */
  otherTransport(ids: string[], hid: string | undefined, kind: string): void;
  adjustTravel(hid: string, delta: number): void;
  toggleDecon(hid: string): void;
  adjustCapacity(hid: string, c: TransportColor, delta: number): void;

  confirm(s: Suggestion): void;
  undo(): void;
  refreshTravel(force?: boolean): Promise<void>;
}

/** 依目前檢傷系統重新產生所有代碼 */
function relabel(patients: Patient[], system: TriageSystem): Patient[] {
  return patients.map((p) => ({ ...p, label: patientLabel(p.color, p.num, p.redClass, system) }));
}

function freshIncident(): Incident {
  return {
    types: [],
    location: null,
    startAt: null,
    settings: { ...DEFAULT_SETTINGS, ...loadSettingsPref<Settings>() },
    log: [],
  };
}

function freshPersisted(): Persisted {
  return {
    incident: freshIncident(),
    patients: [],
    vehicles: [],
    runtime: initialRuntimes(),
    travel: { byHospital: {}, updatedAt: null, source: 'offline' },
    counters: { R: 0, Y: 0, G: 0, K: 0 },
    seq: 0,
    undoStack: [],
  };
}

/** 手動倍率（自動時為 0） */
export function manualFactor(st: Settings): number {
  return st.trafficAuto ? 0 : st.trafficFactor;
}

/** 現場座標鍵（地點變更即重查車程） */
export function locKey(loc: IncidentLocation): string {
  return `${loc.lat.toFixed(5)},${loc.lng.toFixed(5)}`;
}

/** 分隊或支援來源到現場的分鐘數：已查到即時車程用即時，否則離線估算 × 時段係數（trafficFactor > 0 為手動倍率） */
export function sourceEtaMin(
  name: string,
  loc: IncidentLocation | null,
  travel: TravelState,
  trafficFactor: number,
): { min: number; online: boolean } | null {
  if (!loc) return null;
  if (travel.forKey === locKey(loc) && travel.unitEta?.[name] !== undefined) return { min: travel.unitEta[name], online: true };
  const u = FIRE_UNITS.find((x) => x.name === name);
  const f = (lat: number, lng: number) => timeFactor(haversineKm(lat, lng, loc.lat, loc.lng) * 1.35, new Date(), trafficFactor);
  if (u) return { min: etaFromUnit(u, loc) * f(u.lat, u.lng), online: false };
  const src = SUPPORT_SOURCES.find((x) => x.name === name);
  if (src?.lat !== undefined && src.lng !== undefined) return { min: etaFromPoint(src.lat, src.lng, loc) * f(src.lat, src.lng), online: false };
  return null;
}

/** 目前案件的存檔資料 */
function persistedOf(st: Persisted): Persisted {
  return {
    incident: st.incident,
    patients: st.patients,
    vehicles: st.vehicles,
    runtime: st.runtime,
    travel: st.travel,
    counters: st.counters,
    seq: st.seq,
    undoStack: [],
  };
}

/** 案件存檔列 */
export function archiveRowOf(st: Persisted, now: number): ArchiveRow | null {
  const startAt = st.incident.startAt;
  if (!startAt) return null;
  const types = st.incident.types.map((t) => INCIDENT_TYPE_BY_ID[t]?.name).filter(Boolean).join('＋');
  return {
    id: `case-${startAt}`,
    savedAt: now,
    startAt,
    endAt: st.incident.endAt ?? null,
    title: [st.incident.location?.label ?? '未指定地點', types].filter(Boolean).join('｜'),
    total: st.patients.length,
    drill: !!st.incident.drill,
    data: persistedOf(st),
  };
}

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export const useStore = create<Store>((set, get) => {
  /** 新紀錄標上操作者並寫入稽核軌跡 */
  const stamp = (entries: LogEntry[]): LogEntry[] =>
    entries.map((e) => {
      if (e.by !== undefined) return e;
      const by = operatorName();
      audit('異動', e.text);
      return { ...e, by };
    });
  const log = (text: string) =>
    set((s) => ({ incident: { ...s.incident, log: [...s.incident.log, ...stamp([{ at: Date.now(), text }])] } }));

  const domain = (): DomainState => {
    const s = get();
    return { patients: s.patients, vehicles: s.vehicles, runtime: s.runtime, log: s.incident.log };
  };
  const applyDomain = (d: DomainState) =>
    set((s) => ({
      patients: d.patients,
      vehicles: d.vehicles,
      runtime: d.runtime,
      incident: { ...s.incident, log: d.log.length > s.incident.log.length ? [...d.log.slice(0, s.incident.log.length), ...stamp(d.log.slice(s.incident.log.length))] : d.log },
    }));

  const patchRuntime = (hid: string, f: (r: HospitalRuntime) => HospitalRuntime) =>
    set((s) => ({ runtime: { ...s.runtime, [hid]: f(s.runtime[hid]) } }));

  const nextVehicleName = (prefix: string, start: number) => {
    const names = new Set(get().vehicles.map((v) => v.name));
    let n = start;
    while (names.has(`${prefix}${n}`)) n++;
    return `${prefix}${n}`;
  };

  return {
    ...freshPersisted(),
    hydrated: false,
    theme: typeof localStorage === 'undefined' ? 'night' : loadTheme(),
    setTheme: (theme) => {
      try {
        localStorage.setItem(THEME_KEY, theme);
      } catch {
        /* 忽略 */
      }
      set({ theme });
    },
    adjustCrew: (id, kind, delta) => {
      const v = get().vehicles.find((x) => x.id === id);
      if (!v) return;
      const val = Math.max(0, (v[kind] ?? 0) + delta);
      set((s) => ({ vehicles: s.vehicles.map((x) => (x.id === id ? { ...x, [kind]: val } : x)) }));
      log(`${v.name} ${kind === 'emtp' ? 'EMTP' : 'EMT-2'} → ${val} 人`);
    },
    tab: 'incident',
    now: Date.now(),
    online: typeof navigator === 'undefined' ? true : navigator.onLine,

    setTab: (tab) => {
      if (tab !== get().tab) audit('查閱', { incident: '事件', scene: '現場', progress: '送醫進度', report: '回報' }[tab]);
      set({ tab });
    },
    endIncident: () => {
      const s = get();
      if (!s.incident.startAt || s.incident.endAt) return;
      const at = Date.now();
      set({ incident: { ...s.incident, endAt: at } });
      log(`案件結束 ${fmtClock(at)}`);
      // 案件結束自動存檔
      void get().archiveCurrent();
    },
    archivedAt: null,
    archiveRev: 0,
    bumpArchives: () => set((s) => ({ archiveRev: s.archiveRev + 1 })),
    archiveCurrent: async () => {
      const row = archiveRowOf(get(), Date.now());
      if (!row) return false;
      const ok = await putArchive(row);
      if (ok) set((s) => ({ archivedAt: row.savedAt, archiveRev: s.archiveRev + 1 }));
      return ok;
    },
    deleteAllDrills: async () => {
      const s = get();
      const current = s.incident.drill && s.incident.startAt ? `case-${s.incident.startAt}` : null;
      if (current) {
        // 目前的演練案件直接清除，不存檔
        await deletePatientMedia(s.patients.map((p) => p.id));
        set({ ...freshPersisted(), tab: 'incident', archivedAt: null });
      }
      const ids = await deleteDrillArchives();
      const n = ids.length + (current && !ids.includes(current) ? 1 : 0);
      audit('刪除所有演練案件', `${n} 件`);
      set((st) => ({ archiveRev: st.archiveRev + 1, photoRev: st.photoRev + 1 }));
      return n;
    },
    loadArchive: async (id) => {
      const row = await getArchive(id);
      const snap = row?.data as Persisted | undefined;
      if (!snap?.incident) return false;
      // 先保存目前案件，避免覆蓋遺失
      await get().archiveCurrent();
      await saveSnapshot({ ...snap, undoStack: [] });
      set({ hydrated: false });
      await get().hydrate();
      set({ archivedAt: row!.savedAt });
      return true;
    },
    reopenIncident: () => {
      const s = get();
      if (!s.incident.endAt) return;
      set({ incident: { ...s.incident, endAt: null } });
      log(`案件重新開啟 ${fmtClock(Date.now())}`);
    },
    markMilestone: (name) => {
      if (!get().incident.startAt) get().startIncident(false);
      const at = Date.now();
      set((s) => ({ incident: { ...s.incident, milestones: { ...(s.incident.milestones ?? {}), [name]: at } } }));
      log(`${name} ${fmtClock(at)}`);
    },
    tick: () => set({ now: Date.now(), online: typeof navigator === 'undefined' ? true : navigator.onLine }),

    hydrate: async () => {
      const snap = await loadSnapshot<Persisted>();
      if (snap && snap.incident) {
        // 新增醫院時補上預設 runtime
        const runtime = { ...initialRuntimes(), ...snap.runtime };
        const incident = { ...snap.incident, settings: { ...DEFAULT_SETTINGS, ...snap.incident.settings } };
        const vehicles = (snap.vehicles ?? []).map((v) => ({ ...v, emt2: v.emt2 ?? 2, emtp: v.emtp ?? 0 }));
        const counters = { ...snap.counters };
        const patients = relabel(
          (snap.patients ?? []).map((p) => (p.num ? p : { ...p, num: (counters[p.color] = (counters[p.color] ?? 0) + 1) })),
          incident.settings.triageSystem,
        );
        set({ ...freshPersisted(), ...snap, incident, vehicles, patients, counters, runtime, hydrated: true, tab: snap.incident.startAt ? 'scene' : 'incident' });
      } else set({ hydrated: true });
    },

    // ---------- 事件 ----------
    toggleType: (id) => {
      const s = get();
      const had = s.incident.types.includes(id);
      const types = had ? s.incident.types.filter((t) => t !== id) : [...s.incident.types, id];
      set({ incident: { ...s.incident, types } });
      if (s.incident.startAt) {
        log(`事件類型${had ? '移除' : '新增'}：${INCIDENT_TYPE_BY_ID[id]?.name}（已重算）`);
        if (!had && id === 'hazmat') {
          const list = hazmatNotifyList(s.patients, s.runtime);
          for (const x of list) {
            log(`⚠ 請通知 ${HOSPITAL_BY_ID[x.hospitalId]?.short}：${x.labels.join('、')} 未除污即送達`);
          }
        }
      }
    },

    setLocation: (loc) => {
      const j = locate(loc.lat, loc.lng);
      loc = { ...loc, township: loc.township ?? j.township, area: j.area, unit: j.unit };
      const s = get();
      const now = Date.now();
      // 趕赴中車輛依新地點重估 ETA（自加入起算；即時車程查到後再更新）
      const travel = offlineTravelState(loc, now);
      const vehicles = s.vehicles.map((v) => {
        if (v.status !== 'enroute') return v;
        const eta = sourceEtaMin(v.unit, loc, travel, manualFactor(s.incident.settings));
        return eta ? { ...v, etaToSceneMin: (now - v.addedAt) / 60000 + eta.min } : v;
      });
      set({ incident: { ...s.incident, location: loc }, travel, vehicles });
      if (s.incident.startAt) log(`事發地點變更：${loc.label}`);
      void get().refreshTravel(true);
    },

    startIncident: (goToInput = true) => {
      const s = get();
      if (s.incident.startAt) return;
      const now = Date.now();
      // 事件發生當下估算車程（時段、路況）
      if (s.incident.location) {
        const loc = s.incident.location;
        if (s.travel.source !== 'online') set({ travel: offlineTravelState(loc, now) });
        setTimeout(() => void get().refreshTravel(true), 0);
      }
      set({ incident: { ...s.incident, startAt: now }, now, ...(goToInput ? { tab: 'scene' as Tab } : {}) });
      const names = s.incident.types.map((t) => INCIDENT_TYPE_BY_ID[t]?.name).join('＋') || '未指定';
      log(`事件開始：${names}｜地點：${s.incident.location?.label ?? '未指定'}`);
    },

    updateSettings: (p) => {
      const s = get();
      const settings = { ...s.incident.settings, ...p };
      saveSettingsPref(settings);
      const changedSystem = p.triageSystem && p.triageSystem !== s.incident.settings.triageSystem;
      set({
        incident: { ...s.incident, settings },
        patients: changedSystem ? relabel(s.patients, settings.triageSystem) : s.patients,
      });
      if (changedSystem && s.incident.startAt) log(`檢傷系統切換為 ${settings.triageSystem}`);
    },

    clearIncident: () => {
      // 清除前若有案件則先存檔（同一案件覆寫，不會重複）
      const row = archiveRowOf(get(), Date.now());
      if (row) void putArchive(row).then((ok) => ok && get().bumpArchives());
      set({ ...freshPersisted(), tab: 'incident', archivedAt: null });
    },

    // ---------- 傷患 ----------
    addPatient: (c, redClass) => {
      if (!get().incident.startAt) get().startIncident(false);
      const s = get();
      const now = Date.now();
      const num = s.counters[c] + 1;
      const cls = c === 'R' ? redClass : undefined;
      const label = patientLabel(c, num, cls, s.incident.settings.triageSystem);
      const p: Patient = {
        id: uid(),
        color: c,
        label,
        num,
        redClass: cls,
        prevLabels: [],
        seq: s.seq + 1,
        tags: [],
        status: 'waiting',
        history: [{ at: now, action: `新增 ${label}` }],
      };
      set({ patients: [...s.patients, p], counters: { ...s.counters, [c]: s.counters[c] + 1 }, seq: s.seq + 1 });
      log(`新增傷患 ${label}`);
    },

    removeLastPatient: (c) => {
      const s = get();
      const last = [...s.patients].reverse().find((p) => p.color === c && p.status === 'waiting');
      if (!last) return;
      set({ patients: s.patients.filter((p) => p.id !== last.id) });
      log(`撤銷傷患 ${last.label}`);
    },

    toggleTag: (id, tag) => {
      const now = Date.now();
      const name = PATIENT_TAGS.find((t) => t.id === tag)?.name ?? tag;
      let label = '';
      let on = false;
      set((s) => ({
        patients: s.patients.map((p) => {
          if (p.id !== id) return p;
          label = p.label;
          on = !p.tags.includes(tag);
          const tags = on ? [...p.tags, tag] : p.tags.filter((t) => t !== tag);
          return { ...p, tags, history: [...p.history, { at: now, action: `${on ? '加' : '移除'}標籤：${name}` }] };
        }),
      }));
      // 標籤變動只記在病人紀錄，不列入案件經過
      void label;
    },

    retriage: (id, c, redClass) => {
      const s = get();
      const p = s.patients.find((x) => x.id === id);
      if (!p) return;
      if (p.color === c) {
        if (c === 'R' && redClass) get().setRedClass(id, redClass);
        return;
      }
      const now = Date.now();
      const num = s.counters[c] + 1;
      const cls = c === 'R' ? redClass : undefined;
      const label = patientLabel(c, num, cls, s.incident.settings.triageSystem);
      const upgrade = c === 'R' && (p.color === 'Y' || p.color === 'G');
      set({
        counters: { ...s.counters, [c]: num },
        patients: s.patients.map((x) =>
          x.id === id
            ? {
                ...x,
                color: c,
                num,
                redClass: cls,
                label,
                prevLabels: [...x.prevLabels, x.label],
                // 降級（如紅→黃）移除較高等級的傷勢
                trauma: keepForColor(x.trauma, c),
                history: [...x.history, { at: now, action: `${upgrade ? '升級紅傷' : '再檢傷'}：${x.label} → ${label}` }],
              }
            : x,
        ),
      });
      log(upgrade ? `⚠ 特殊事件｜檢傷升級為紅傷：${p.label} → ${label}` : `再檢傷：${p.label} → ${label}`);
    },

    setRedClass: (id, cls) => {
      const s = get();
      const p = s.patients.find((x) => x.id === id);
      if (!p || p.color !== 'R' || p.redClass === cls) return;
      const now = Date.now();
      const label = patientLabel('R', p.num, cls, s.incident.settings.triageSystem);
      set({
        patients: s.patients.map((x) =>
          x.id === id
            ? { ...x, redClass: cls, label, history: [...x.history, { at: now, action: `紅傷分類：${x.label} → ${label}` }] }
            : x,
        ),
      });
      log(`紅傷分類：${p.label} → ${label}`);
    },

    setTrauma: (id, trauma) =>
      set((s) => ({ patients: s.patients.map((p) => (p.id === id ? { ...p, trauma } : p)) })),
    setWounds: (id, wounds) =>
      set((s) => ({ patients: s.patients.map((p) => (p.id === id ? { ...p, wounds } : p)) })),

    setPatientNote: (id, note) =>
      set((s) => ({ patients: s.patients.map((p) => (p.id === id ? { ...p, note: note.slice(0, 200) } : p)) })),

    addVehicle: (unitName, num, tp, t2) => {
      if (!get().incident.startAt) get().startIncident(false);
      const s = get();
      const unit = FIRE_UNITS.find((u) => u.name === unitName);
      const src = SUPPORT_SOURCES.find((x) => x.name === unitName);
      if (!unit && !src) return;
      const name = `${unit ? unit.name : src!.prefix}${num}`;
      if (s.vehicles.some((v) => v.name === name)) return;
      const now = Date.now();
      // 第 1 輛到場車留守（大傷 SOP）
      const hold = s.incident.settings.firstVehicleHold && !s.vehicles.some((v) => v.wasHeld);
      const [lat, lng] = unit ? unitCoord(unit) : [src!.lat ?? 0, src!.lng ?? 0];
      const v: Vehicle = {
        id: uid(),
        name,
        unit: unit ? unit.name : src!.name,
        source: unit ? 'county' : 'support',
        originLat: lat,
        originLng: lng,
        status: 'standby',
        addedAt: now,
        etaToSceneMin: 0,
        trips: 0,
        emt2: t2,
        emtp: tp,
        standbySince: now,
        ...(hold ? { held: true, wasHeld: true } : {}),
      };
      set({ vehicles: [...s.vehicles, v] });
      log(`${name} 到場（TP ${tp}、T2 ${t2}）${hold ? '｜第 1 輛到場：留守現場' : ''}`);
    },

    dispatchManual: (patientIds, vehicleId, hospitalId) => {
      const s = get();
      // 受困中不可派車（防呆）
      const ps = s.patients.filter((p) => patientIds.includes(p.id) && p.status === 'waiting' && !p.trapped);
      const v = s.vehicles.find((x) => x.id === vehicleId);
      if (!ps.length || !v) return;
      const tr = effectiveTravel(s.travel.byHospital[hospitalId], s.runtime[hospitalId], s.incident.settings);
      const color = (['R', 'Y', 'G'] as const).find((c) => ps.some((p) => p.color === c)) ?? 'G';
      const sug: Suggestion = {
        key: `manual-${Date.now()}`,
        color,
        patientIds: ps.map((p) => p.id),
        vehicleId,
        tripNo: v.trips + 1,
        hospitalId,
        idealHospitalId: hospitalId,
        availableMin: 0,
        departMin: 0,
        arriveMin: tr?.go ?? 0,
        returnMin: (tr?.go ?? 0) + s.incident.settings.handoverMin + (tr?.back ?? 0),
        goMin: tr?.go ?? 20,
        backMin: tr?.back ?? 20,
        score: 0,
        confirmable: true,
        needsArrivalMark: false,
        warnings: [],
      };
      // 留守車：剩最後 2 位傷患才可派；選定出發時視為解除留守
      if (v.held && !holdUnlocked(s.patients)) return;
      if (v.held) set((st) => ({ vehicles: st.vehicles.map((x) => (x.id === v.id ? { ...x, held: false } : x)) }));
      if (v.status === 'enroute') applyDomain(setVehicleStatus(domain(), v.id, 'standby', Date.now(), false));
      get().confirm(sug);
    },

    setPersonal: (id, p) =>
      set((s) => ({ patients: s.patients.map((x) => (x.id === id ? { ...x, personal: { ...(x.personal ?? {}), ...p } } : x)) })),
    photoRev: 0,
    bumpPhotos: () => set((s) => ({ photoRev: s.photoRev + 1 })),
    compositeRev: 0,
    bumpComposites: () => set((s) => ({ compositeRev: s.compositeRev + 1 })),
    setTriageTagNo: (id, no) =>
      set((s) => ({ patients: s.patients.map((p) => (p.id === id ? { ...p, triageTagNo: no } : p)) })),

    deletePatient: (id) => {
      const s = get();
      const p = s.patients.find((x) => x.id === id);
      if (!p) return;
      set({ patients: s.patients.filter((x) => x.id !== id) });
      log(`刪除傷患 ${p.label}`);
    },

    // ---------- 車輛 ----------
    addUnitVehicle: (unitName) => {
      if (!get().incident.startAt) get().startIncident(false);
      const s = get();
      const unit = FIRE_UNITS.find((u) => u.name === unitName);
      if (!unit) return;
      const name = nextVehicleName(unit.name, 91);
      const loc = s.incident.location;
      const now = Date.now();
      const [lat, lng] = unitCoord(unit);
      const v: Vehicle = {
        id: uid(),
        name,
        unit: unit.name,
        source: 'county',
        originLat: lat,
        originLng: lng,
        status: 'enroute',
        addedAt: now,
        etaToSceneMin: sourceEtaMin(unit.name, loc, s.travel, manualFactor(s.incident.settings))?.min ?? 15,
        trips: 0,
        emt2: s.incident.settings.defaultEmt2,
        emtp: s.incident.settings.defaultEmtp,
      };
      set({ vehicles: [...s.vehicles, v] });
      log(`新增車輛 ${name}（趕赴中，ETA ${Math.round(v.etaToSceneMin ?? 0)} 分）`);
    },

    addSupportVehicle: (srcName) => {
      if (!get().incident.startAt) get().startIncident(false);
      const s = get();
      const src = SUPPORT_SOURCES.find((x) => x.name === srcName);
      if (!src) return;
      const name = nextVehicleName(src.prefix, 1);
      const loc = s.incident.location;
      const now = Date.now();
      const eta = sourceEtaMin(src.name, loc, s.travel, manualFactor(s.incident.settings))?.min ?? src.defaultEtaMin ?? 20;
      const v: Vehicle = {
        id: uid(),
        name,
        unit: src.name,
        source: 'support',
        originLat: src.lat ?? 0,
        originLng: src.lng ?? 0,
        status: 'enroute',
        addedAt: now,
        etaToSceneMin: eta,
        trips: 0,
        emt2: s.incident.settings.defaultEmt2,
        emtp: s.incident.settings.defaultEmtp,
      };
      set({ vehicles: [...s.vehicles, v] });
      log(`新增支援車輛 ${name}（趕赴中，ETA ${Math.round(eta)} 分）`);
    },

    setVehicleStatus: (id, status) =>
      applyDomain(setVehicleStatus(domain(), id, status, Date.now(), get().incident.settings.firstVehicleHold)),
    releaseHold: (id) => {
      const v = get().vehicles.find((x) => x.id === id);
      if (!v?.held || !holdUnlocked(get().patients)) return;
      set((st) => ({ vehicles: st.vehicles.map((x) => (x.id === id ? { ...x, held: false } : x)) }));
      log(`${v.name} 解除留守，可重新派車`);
    },
    setHold: (id, on) => {
      const v = get().vehicles.find((x) => x.id === id);
      if (!v || !!v.held === on) return;
      if (!on) return get().releaseHold(id);
      set((st) => ({ vehicles: st.vehicles.map((x) => (x.id === id ? { ...x, held: true, wasHeld: true } : x)) }));
      log(`${v.name} 設為留守`);
    },
    arriveAndConfirm: (sug) => {
      // 這台車是派遣建議選定的，直接到場出發（不指定為留守車）
      applyDomain(setVehicleStatus(domain(), sug.vehicleId, 'standby', Date.now(), false));
      get().confirm(sug);
    },
    groupTransport: (hid) => {
      const s = get();
      const h = HOSPITAL_BY_ID[hid];
      const rt = s.runtime[hid];
      const cap = effectiveCap(h, rt, s.incident.settings).G - rt.used.G - rt.selfPresented.G;
      const rules = combineRules(s.incident.types);
      const greens = s.patients
        .filter((p) => p.color === 'G' && p.status === 'waiting' && missingRequirements(p, rules).length === 0)
        .slice(0, Math.max(0, cap));
      if (!greens.length) return;
      const before = domain();
      const tr = effectiveTravel(s.travel.byHospital[hid], rt, s.incident.settings);
      let d = before;
      for (const p of greens) d = dutyTransportDomain(d, p.id, hid, tr?.go ?? 0, Date.now(), '群送');
      set({ undoStack: [...s.undoStack.slice(-19), { label: `綠傷群送 ${greens.length} 位`, state: before }] });
      applyDomain(d);
    },

    adjustEta: (id, delta) =>
      set((s) => ({
        vehicles: s.vehicles.map((v) => {
          if (v.id !== id) return v;
          if (v.status === 'transport' && v.returnAt) return { ...v, returnAt: v.returnAt + delta * 60000 };
          return { ...v, etaToSceneMin: Math.max(0, (v.etaToSceneMin ?? 0) + delta) };
        }),
      })),

    deleteVehicle: (id) => {
      const s = get();
      const v = s.vehicles.find((x) => x.id === id);
      set({ vehicles: s.vehicles.filter((x) => x.id !== id) });
      if (v) log(`刪除車輛 ${v.name}`);
    },

    // ---------- 醫院 ----------
    adjustSelfPresented: (hid, c, delta) => {
      const r = get().runtime[hid];
      const val = Math.max(0, r.selfPresented[c] + delta);
      if (val === r.selfPresented[c]) return;
      patchRuntime(hid, (r) => ({ ...r, selfPresented: { ...r.selfPresented, [c]: val } }));
      log(`${HOSPITAL_BY_ID[hid].short} 自行到院 ${TRIAGE_NAMES[get().incident.settings.triageSystem][c]} → ${val}`);
    },
    setStrain: (hid, level) => {
      patchRuntime(hid, (r) => ({ ...r, strain: level }));
      log(`${HOSPITAL_BY_ID[hid].short} 負荷：${['正常', '吃緊', '滿載'][level]}`);
    },
    setLeft: (id, left) => applyDomain(setLeftDomain(domain(), id, left, Date.now())),
    setTrapped: (id, trapped) => applyDomain(setTrappedDomain(domain(), id, trapped, Date.now())),
    setDrill: (drill) => {
      if (!!get().incident.drill === drill) return;
      set((s) => ({ incident: { ...s.incident, drill } }));
      log(`環境切換為${drill ? '演練測試' : '正式勤務'}`);
    },
    setPolice: (id, handed) => applyDomain(setPoliceDomain(domain(), id, handed, Date.now())),
    setMorgue: (p) =>
      set((s) => ({ incident: { ...s.incident, morgue: { ...(s.incident.morgue ?? {}), ...p } } })),
    logMorgue: () => {
      const m = get().incident.morgue ?? {};
      const text = [m.location?.trim() && `位置 ${m.location.trim()}`, m.guard?.trim() && `看守 ${m.guard.trim()}`].filter(Boolean).join('｜');
      const last = [...get().incident.log].reverse().find((l) => l.text.startsWith('黑牌暫置區：'));
      if (text && last?.text !== `黑牌暫置區：${text}`) log(`黑牌暫置區：${text}`);
    },
    dutyTransport: (id, hid) => {
      const s = get();
      const before = domain();
      const tr = hid ? effectiveTravel(s.travel.byHospital[hid], s.runtime[hid], s.incident.settings) : null;
      const after = dutyTransportDomain(before, id, hid, tr?.go ?? 0, Date.now());
      const p = s.patients.find((x) => x.id === id);
      set({ undoStack: [...s.undoStack.slice(-19), { label: `${p?.label ?? ''} 勤務車`, state: before }] });
      applyDomain(after);
    },
    otherTransport: (ids, hid, kind) => {
      const s = get();
      const ps = s.patients.filter((p) => ids.includes(p.id) && p.status === 'waiting' && p.color === 'G' && !p.trapped);
      if (!ps.length) return;
      const before = domain();
      const tr = hid ? effectiveTravel(s.travel.byHospital[hid], s.runtime[hid], s.incident.settings) : null;
      const now = Date.now();
      let d = before;
      for (const p of ps) d = dutyTransportDomain(d, p.id, hid, (tr?.go ?? 0) + s.incident.settings.loadMin, now, kind);
      set({ undoStack: [...s.undoStack.slice(-19), { label: `${ps.map((p) => p.label).join('、')} ${kind}`, state: before }] });
      applyDomain(d);
    },
    toggleBypass: (hid) => {
      const on = !get().runtime[hid].bypass;
      patchRuntime(hid, (r) => ({ ...r, bypass: on }));
      log(`${HOSPITAL_BY_ID[hid].short} ${on ? '關閉（Bypass）' : '重新開啟'}`);
    },
    adjustTravel: (hid, delta) => {
      patchRuntime(hid, (r) => ({ ...r, travelAdjustMin: r.travelAdjustMin + delta }));
      log(`${HOSPITAL_BY_ID[hid].short} 車程修正 ${get().runtime[hid].travelAdjustMin >= 0 ? '+' : ''}${get().runtime[hid].travelAdjustMin} 分`);
    },
    toggleDecon: (hid) => {
      patchRuntime(hid, (r) => ({ ...r, decon: !r.decon }));
      log(`${HOSPITAL_BY_ID[hid].short} 除污能力：${get().runtime[hid].decon ? '有' : '無'}`);
    },
    adjustCapacity: (hid, c, delta) => {
      const s = get();
      const h = HOSPITAL_BY_ID[hid];
      const r = s.runtime[hid];
      const base = r.capacityOverride ?? (s.incident.settings.nightMode && h.capacityNight ? h.capacityNight : h.capacity);
      const next = { ...base, [c]: Math.max(0, base[c] + delta) };
      patchRuntime(hid, (r) => ({ ...r, capacityOverride: next }));
      log(`${h.short} ${TRIAGE_NAMES[get().incident.settings.triageSystem][c]}傷容量 → ${next[c]}`);
    },

    // ---------- 派遣 ----------
    confirm: (sug) => {
      const s = get();
      const before = domain();
      const rules = combineRules(s.incident.types);
      const after = confirmDispatch(before, sug, Date.now(), s.incident.settings, rules);
      const labels = s.patients.filter((p) => sug.patientIds.includes(p.id)).map((p) => p.label).join('、');
      set({ undoStack: [...s.undoStack.slice(-19), { label: labels, state: before }] });
      applyDomain(after);
    },

    undo: () => {
      const s = get();
      const last = s.undoStack[s.undoStack.length - 1];
      if (!last) return;
      // 保留撤銷後新增的紀錄
      const log = [...s.incident.log, ...stamp([{ at: Date.now(), text: `撤銷派車：${last.label}` }])];
      set({
        undoStack: s.undoStack.slice(0, -1),
        patients: last.state.patients,
        vehicles: last.state.vehicles,
        runtime: last.state.runtime,
        incident: { ...s.incident, log },
      });
    },

    refreshTravel: async (force = false) => {
      const s = get();
      const loc = s.incident.location;
      if (!loc || !routesEnabled()) return;
      const key = locKey(loc);
      // 事故地點確定後只查一次；地點變更或手動重查才再查
      if (!force && s.travel.source === 'online' && s.travel.forKey === key) return;
      const units = [
        ...FIRE_UNITS.map((u) => ({ id: u.name, lat: u.lat, lng: u.lng })),
        ...SUPPORT_SOURCES.filter((x) => x.lat !== undefined && x.lng !== undefined).map((x) => ({ id: x.name, lat: x.lat!, lng: x.lng! })),
      ];
      try {
        const fallback = offlineTravelState(loc, Date.now()).byHospital;
        const res = await fetchOnlineTravel(
          { lat: loc.lat, lng: loc.lng },
          HOSPITALS.map((h) => ({ id: h.id, lat: h.lat, lng: h.lng })),
          units,
          fallback,
        );
        const now = Date.now();
        // 地點在查詢期間被變更 → 丟棄結果
        if (get().incident.location !== loc) return;
        set((st) => ({
          travel: { byHospital: res.byHospital, unitEta: res.unitEta, forKey: key, updatedAt: now, source: 'online' },
          // 趕赴中車輛改用即時到場時間（自出發起算）
          vehicles: st.vehicles.map((v) =>
            v.status === 'enroute' && res.unitEta[v.unit] !== undefined ? { ...v, etaToSceneMin: res.unitEta[v.unit] } : v,
          ),
        }));
      } catch (e) {
        set((st) => ({ travel: { ...st.travel, error: String((e as Error).message ?? e) } }));
      }
    },
  };
});

// ---------- 持久化 ----------
let timer: ReturnType<typeof setTimeout> | null = null;
useStore.subscribe((s, prev) => {
  if (!s.hydrated) return;
  if (
    s.incident === prev.incident &&
    s.patients === prev.patients &&
    s.vehicles === prev.vehicles &&
    s.runtime === prev.runtime &&
    s.travel === prev.travel &&
    s.undoStack === prev.undoStack
  )
    return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    const st = useStore.getState();
    const data: Persisted = { ...persistedOf(st), undoStack: st.undoStack };
    void saveSnapshot(data);
  }, 300);
});

// ---------- 唯讀（交接檢視模式） ----------
const READ_SAFE = new Set(['setTheme', 'setTab', 'tick', 'hydrate', 'refreshTravel', 'archiveCurrent', 'bumpArchives', 'bumpPhotos', 'bumpComposites']);
let readOnly = false;
export function setReadOnly(v: boolean) {
  readOnly = v;
}
export function isReadOnly() {
  return readOnly;
}
{
  const st = useStore.getState() as unknown as Record<string, unknown>;
  const wrapped: Record<string, unknown> = {};
  for (const [k, f] of Object.entries(st)) {
    if (typeof f !== 'function' || READ_SAFE.has(k)) continue;
    wrapped[k] = (...a: unknown[]) => (readOnly ? undefined : (f as (...x: unknown[]) => unknown)(...a));
  }
  useStore.setState(wrapped as Partial<ReturnType<typeof useStore.getState>>);
}

// ---------- 視窗編輯：確認／返回（不存檔） ----------
type EditSnap = Pick<Persisted, 'incident' | 'patients' | 'vehicles' | 'runtime' | 'counters' | 'seq' | 'undoStack'>;
const editSnaps = new Map<number, EditSnap>();
let editSeq = 0;
/** 開啟視窗：記下目前資料 */
export function beginEdit(): number {
  const s = useStore.getState();
  const id = ++editSeq;
  editSnaps.set(id, { incident: s.incident, patients: s.patients, vehicles: s.vehicles, runtime: s.runtime, counters: s.counters, seq: s.seq, undoStack: s.undoStack });
  return id;
}
/** 確認：保留修改 */
export function commitEdit(id: number) {
  editSnaps.delete(id);
}
/** 返回：還原為開啟視窗時的資料 */
export function cancelEdit(id: number) {
  const snap = editSnaps.get(id);
  editSnaps.delete(id);
  if (!snap || readOnly) return;
  useStore.setState({ ...snap });
}
/** 是否有視窗正在編輯（同步時暫不送出） */
export function isEditing(): boolean {
  return editSnaps.size > 0;
}
/** 視窗開啟期間收到他人的修改：一併記入，返回時不會蓋掉他人的修改 */
export function noteRemote(
  prev: Pick<EditSnap, 'incident' | 'patients' | 'vehicles' | 'runtime'>,
  next: Pick<EditSnap, 'incident' | 'patients' | 'vehicles' | 'runtime' | 'counters' | 'seq'>,
) {
  if (!editSnaps.size) return;
  const changedIds = <T extends { id: string }>(a: T[], b: T[]) => {
    const pm = new Map(a.map((x) => [x.id, x]));
    const nm = new Map(b.map((x) => [x.id, x]));
    const ids = new Set([...pm.keys(), ...nm.keys()]);
    return [...ids].filter((id) => pm.get(id) !== nm.get(id)).map((id) => ({ id, v: nm.get(id) }));
  };
  const rebase = <T extends { id: string }>(snap: T[], ch: { id: string; v: T | undefined }[]) => {
    let out = snap;
    for (const { id, v } of ch) {
      const i = out.findIndex((x) => x.id === id);
      if (v && i >= 0) out = out.map((x, j) => (j === i ? v : x));
      else if (v) out = [...out, v];
      else if (i >= 0) out = out.filter((x) => x.id !== id);
    }
    return out;
  };
  const pc = changedIds(prev.patients, next.patients);
  const vc = changedIds(prev.vehicles, next.vehicles);
  const prevLog = new Set(prev.incident.log.map((l) => `${l.at}|${l.text}`));
  const newLog = next.incident.log.filter((l) => !prevLog.has(`${l.at}|${l.text}`));
  for (const [id, snap] of editSnaps) {
    const runtime = { ...snap.runtime };
    for (const hid of Object.keys(next.runtime)) if (prev.runtime[hid] !== next.runtime[hid]) runtime[hid] = next.runtime[hid];
    const incident = { ...snap.incident };
    for (const f of ['types', 'location', 'startAt', 'settings', 'milestones', 'endAt', 'morgue', 'drill'] as const) {
      if (prev.incident[f] !== next.incident[f]) (incident as unknown as Record<string, unknown>)[f] = next.incident[f];
    }
    incident.log = [...snap.incident.log, ...newLog].sort((a, b) => a.at - b.at);
    editSnaps.set(id, {
      ...snap,
      incident,
      patients: rebase(snap.patients, pc),
      vehicles: rebase(snap.vehicles, vc),
      runtime,
      counters: { R: Math.max(snap.counters.R, next.counters.R), Y: Math.max(snap.counters.Y, next.counters.Y), G: Math.max(snap.counters.G, next.counters.G), K: Math.max(snap.counters.K, next.counters.K) },
      seq: Math.max(snap.seq, next.seq),
    });
  }
}
