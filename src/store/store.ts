import { create } from 'zustand';
import { HOSPITAL_BY_ID, HOSPITALS, initialRuntimes } from '../data/hospitals';
import { FIRE_UNITS, locate, SUPPORT_SOURCES, unitCoord } from '../data/places';
import { INCIDENT_TYPE_BY_ID } from '../data/incidentTypes';
import {
  confirmDispatch,
  dutyTransport as dutyTransportDomain,
  hazmatNotifyList,
  setLeft as setLeftDomain,
  setVehicleStatus,
  type DomainState,
} from '../engine/actions';
import { effectiveTravel } from '../engine/plan';
import type { Suggestion } from '../engine/plan';
import { combineRules } from '../engine/rules';
import { etaFromPoint, etaFromUnit, offlineTravelState } from '../travel';
import { fetchOnlineTravel, routesEnabled } from '../travel/routes';
import {
  TRIAGE_NAMES,
  patientLabel,
  type RedClass,
  type TriageSystem,
  DEFAULT_SETTINGS,
  PATIENT_TAGS,
  type Color,
  type HospitalRuntime,
  type Incident,
  type IncidentLocation,
  type Patient,
  type Settings,
  type TransportColor,
  type TravelState,
  type Vehicle,
  type VehicleStatus,
} from '../types';
import { loadSettingsPref, loadSnapshot, saveSettingsPref, saveSnapshot } from './db';

export type Tab = 'incident' | 'input' | 'fleet' | 'dispatch' | 'hospital' | 'report';
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

interface Persisted {
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
  tick(): void;
  hydrate(): Promise<void>;

  toggleType(id: string): void;
  setLocation(loc: IncidentLocation): void;
  startIncident(): void;
  updateSettings(p: Partial<Settings>): void;
  clearIncident(): void;

  addPatient(c: Color, redClass?: RedClass): void;
  removeLastPatient(c: Color): void;
  toggleTag(id: string, tag: string): void;
  retriage(id: string, c: Color, redClass?: RedClass): void;
  setRedClass(id: string, cls: RedClass): void;
  setTriageTagNo(id: string, no: string): void;
  deletePatient(id: string): void;

  addUnitVehicle(unit: string): void;
  addSupportVehicle(name: string): void;
  setVehicleStatus(id: string, s: VehicleStatus): void;
  adjustEta(id: string, delta: number): void;
  deleteVehicle(id: string): void;

  adjustSelfPresented(hid: string, c: TransportColor, delta: number): void;
  toggleBypass(hid: string): void;
  setStrain(hid: string, level: 0 | 1 | 2): void;
  setLeft(id: string, left: boolean): void;
  dutyTransport(id: string, hid: string | undefined): void;
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

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export const useStore = create<Store>((set, get) => {
  const log = (text: string) =>
    set((s) => ({ incident: { ...s.incident, log: [...s.incident.log, { at: Date.now(), text }] } }));

  const domain = (): DomainState => {
    const s = get();
    return { patients: s.patients, vehicles: s.vehicles, runtime: s.runtime, log: s.incident.log };
  };
  const applyDomain = (d: DomainState) =>
    set((s) => ({
      patients: d.patients,
      vehicles: d.vehicles,
      runtime: d.runtime,
      incident: { ...s.incident, log: d.log },
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

    setTab: (tab) => set({ tab }),
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
        set({ ...freshPersisted(), ...snap, incident, vehicles, patients, counters, runtime, hydrated: true, tab: snap.incident.startAt ? 'input' : 'incident' });
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
      // 趕赴中車輛依新地點重估 ETA（自加入起算）
      const vehicles = s.vehicles.map((v) => {
        if (v.status !== 'enroute') return v;
        const unit = FIRE_UNITS.find((u) => u.name === v.unit);
        const f = s.incident.settings.trafficFactor;
        const eta = unit
          ? etaFromUnit(unit, loc) * f
          : v.originLat
            ? etaFromPoint(v.originLat, v.originLng, loc) * f
            : undefined;
        return eta === undefined ? v : { ...v, etaToSceneMin: (now - v.addedAt) / 60000 + eta };
      });
      set({ incident: { ...s.incident, location: loc }, travel: offlineTravelState(loc, now), vehicles });
      if (s.incident.startAt) log(`事發地點變更：${loc.label}`);
      void get().refreshTravel(true);
    },

    startIncident: () => {
      const s = get();
      if (s.incident.startAt) return;
      const now = Date.now();
      set({ incident: { ...s.incident, startAt: now }, tab: 'input', now });
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
      set({ ...freshPersisted(), tab: 'incident' });
    },

    // ---------- 傷患 ----------
    addPatient: (c, redClass) => {
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
      log(`${label} ${on ? '加' : '移除'}標籤：${name}`);
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
                history: [...x.history, { at: now, action: `再檢傷：${x.label} → ${label}` }],
              }
            : x,
        ),
      });
      log(`再檢傷：${p.label} → ${label}`);
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
        etaToSceneMin: loc ? etaFromUnit(unit, loc) * s.incident.settings.trafficFactor : 15,
        trips: 0,
        emt2: s.incident.settings.defaultEmt2,
        emtp: s.incident.settings.defaultEmtp,
      };
      set({ vehicles: [...s.vehicles, v] });
      log(`新增車輛 ${name}（趕赴中，ETA ${Math.round(v.etaToSceneMin ?? 0)} 分）`);
    },

    addSupportVehicle: (srcName) => {
      const s = get();
      const src = SUPPORT_SOURCES.find((x) => x.name === srcName);
      if (!src) return;
      const name = nextVehicleName(src.prefix, 1);
      const loc = s.incident.location;
      const now = Date.now();
      const eta =
        src.lat !== undefined && loc
          ? etaFromPoint(src.lat, src.lng!, loc) * s.incident.settings.trafficFactor
          : src.defaultEtaMin ?? 20;
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

    setVehicleStatus: (id, status) => applyDomain(setVehicleStatus(domain(), id, status, Date.now())),

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
      log(`${HOSPITAL_BY_ID[hid].short} 負荷：${['正常', '吃緊', '爆量'][level]}`);
    },
    setLeft: (id, left) => applyDomain(setLeftDomain(domain(), id, left, Date.now())),
    dutyTransport: (id, hid) => {
      const s = get();
      const before = domain();
      const tr = hid ? effectiveTravel(s.travel.byHospital[hid], s.runtime[hid], s.incident.settings) : null;
      const after = dutyTransportDomain(before, id, hid, tr?.go ?? 0, Date.now());
      const p = s.patients.find((x) => x.id === id);
      set({ undoStack: [...s.undoStack.slice(-19), { label: `${p?.label ?? ''} 勤務車`, state: before }] });
      applyDomain(after);
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
      const log = [...s.incident.log, { at: Date.now(), text: `撤銷確認出發：${last.label}` }];
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
      if (!force && s.travel.source === 'online' && s.travel.updatedAt && Date.now() - s.travel.updatedAt < 5 * 60000) return;
      const enroute = s.vehicles
        .filter((v) => v.status === 'enroute')
        .map((v) => {
          const u = FIRE_UNITS.find((x) => x.name === v.unit);
          return { v, u };
        });
      const origins = enroute
        .map(({ v, u }) => {
          const c = u ? unitCoord(u) : v.originLat ? [v.originLat, v.originLng] : null;
          return c ? { id: v.id, lat: c[0], lng: c[1] } : null;
        })
        .filter((x): x is { id: string; lat: number; lng: number } => !!x);
      try {
        const fallback = offlineTravelState(loc, Date.now()).byHospital;
        const res = await fetchOnlineTravel(
          { lat: loc.lat, lng: loc.lng },
          HOSPITALS.map((h) => ({ id: h.id, lat: h.lat, lng: h.lng })),
          origins,
          fallback,
        );
        const now = Date.now();
        // 地點在查詢期間被變更 → 丟棄結果
        if (get().incident.location !== loc) return;
        set((st) => ({
          travel: { byHospital: res.byHospital, updatedAt: now, source: 'online' },
          vehicles: st.vehicles.map((v) =>
            v.status === 'enroute' && res.vehicleEta[v.id] !== undefined
              ? { ...v, etaToSceneMin: (now - v.addedAt) / 60000 + res.vehicleEta[v.id] }
              : v,
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
    const data: Persisted = {
      incident: st.incident,
      patients: st.patients,
      vehicles: st.vehicles,
      runtime: st.runtime,
      travel: st.travel,
      counters: st.counters,
      seq: st.seq,
      undoStack: st.undoStack,
    };
    void saveSnapshot(data);
  }, 300);
});
