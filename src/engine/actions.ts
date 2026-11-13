// 「確認出發」等改變真實狀態的動作（規格書 6.4），以純函式實作便於測試。
import type { HospitalRuntime, LogEntry, Patient, Settings, Vehicle, VehicleStatus } from '../types';
import { HOSPITAL_BY_ID } from '../data/hospitals';
import type { CombinedRules } from './rules';
import { vehicleNeedsDecon, type Suggestion } from './plan';

export interface DomainState {
  patients: Patient[];
  vehicles: Vehicle[];
  runtime: Record<string, HospitalRuntime>;
  log: LogEntry[];
}

export function fmtClock(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function confirmDispatch(
  s: DomainState,
  sug: Suggestion,
  now: number,
  settings: Settings,
  rules: CombinedRules,
): DomainState {
  const h = HOSPITAL_BY_ID[sug.hospitalId];
  const vehicle = s.vehicles.find((v) => v.id === sug.vehicleId);
  if (!h || !vehicle) return s;
  const ids = new Set(sug.patientIds);
  const totalMin = settings.loadMin + sug.goMin + settings.handoverMin + sug.backMin;
  const contaminate = vehicleNeedsDecon(rules, settings);

  const patients = s.patients.map((p) =>
    ids.has(p.id)
      ? {
          ...p,
          status: 'sent' as const,
          hospitalId: h.id,
          vehicleId: vehicle.id,
          sentAt: now,
          arriveAt: now + (settings.loadMin + sug.goMin) * 60000,
          history: [...p.history, { at: now, action: `確認出發：${vehicle.name} ➔ ${h.short}` }],
        }
      : p,
  );
  const rt = s.runtime[h.id];
  const used = { ...rt.used };
  for (const p of s.patients) if (ids.has(p.id) && p.color !== 'K') used[p.color as 'R' | 'Y' | 'G'] += 1;
  const runtime = { ...s.runtime, [h.id]: { ...rt, used } };
  const vehicles = s.vehicles.map((v) =>
    v.id === vehicle.id
      ? {
          ...v,
          status: 'transport' as const,
          returnAt: now + totalMin * 60000,
          trips: v.trips + 1,
          lastHospitalId: h.id,
          contaminated: v.contaminated || contaminate,
        }
      : v,
  );
  const labels = s.patients.filter((p) => ids.has(p.id)).map((p) => p.label).join('、');
  const log = [
    ...s.log,
    {
      at: now,
      text: `確認出發：${labels} ➔ ${vehicle.name}（第${vehicle.trips + 1}趟）➔ ${h.short}｜預估抵院 ${fmtClock(
        now + (settings.loadMin + sug.goMin) * 60000,
      )}、返場 ${fmtClock(now + totalMin * 60000)}${contaminate ? '｜返場後待除污' : ''}`,
    },
  ];
  return { patients, vehicles, runtime, log };
}

/** 變更車輛狀態。標示返場/待命時，若車輛已污染則自動轉為待除污。 */
export function setVehicleStatus(
  s: DomainState,
  vehicleId: string,
  status: VehicleStatus,
  now: number,
): DomainState {
  const v = s.vehicles.find((x) => x.id === vehicleId);
  if (!v) return s;
  let next: VehicleStatus = status;
  let contaminated = v.contaminated;
  let text = '';
  if (status === 'standby' && v.status === 'decon') {
    contaminated = false;
    text = `${v.name} 除污完成，現場待命`;
  } else if (status === 'standby' && v.contaminated) {
    next = 'decon';
    text = `${v.name} 返場，待除污`;
  } else {
    text = `${v.name} 狀態 → ${
      { enroute: '趕赴中', standby: '現場待命', transport: '運送中', decon: '待除污', offline: '離線' }[status]
    }`;
  }
  const vehicles = s.vehicles.map((x) =>
    x.id === vehicleId
      ? {
          ...x,
          status: next,
          contaminated,
          returnAt: next === 'transport' ? x.returnAt : undefined,
        }
      : x,
  );
  return { ...s, vehicles, log: [...s.log, { at: now, text }] };
}

/** 加入化災後：已送出、未除污且送往無除污能力醫院者（規格 5.4） */
export function hazmatNotifyList(patients: Patient[], runtime: Record<string, HospitalRuntime>) {
  const byHospital: Record<string, string[]> = {};
  for (const p of patients) {
    if (p.status !== 'sent' || !p.hospitalId) continue;
    if (p.tags.includes('decontaminated')) continue;
    if (runtime[p.hospitalId]?.decon) continue;
    (byHospital[p.hospitalId] ??= []).push(p.label);
  }
  return Object.entries(byHospital).map(([hospitalId, labels]) => ({ hospitalId, labels }));
}

/** 綠傷由勤務車載走（不佔救護車）；hospitalId 為空表示載離現場未定醫院 */
export function dutyTransport(s: DomainState, patientId: string, hospitalId: string | undefined, goMin: number, now: number): DomainState {
  const p = s.patients.find((x) => x.id === patientId);
  if (!p || p.status !== 'waiting') return s;
  const h = hospitalId ? HOSPITAL_BY_ID[hospitalId] : undefined;
  const patients = s.patients.map((x) =>
    x.id === patientId
      ? {
          ...x,
          status: 'sent' as const,
          byDuty: true,
          hospitalId: h?.id,
          sentAt: now,
          arriveAt: h ? now + goMin * 60000 : undefined,
          history: [...x.history, { at: now, action: `勤務車載走${h ? ` ➔ ${h.short}` : ''}` }],
        }
      : x,
  );
  let runtime = s.runtime;
  if (h && p.color !== 'K') {
    const rt = s.runtime[h.id];
    const c = p.color as 'R' | 'Y' | 'G';
    runtime = { ...s.runtime, [h.id]: { ...rt, used: { ...rt.used, [c]: rt.used[c] + 1 } } };
  }
  return { ...s, patients, runtime, log: [...s.log, { at: now, text: `${p.label} 勤務車載走${h ? ` ➔ ${h.short}` : ''}` }] };
}

/** 傷患自行離開／恢復待送 */
export function setLeft(s: DomainState, patientId: string, left: boolean, now: number): DomainState {
  const p = s.patients.find((x) => x.id === patientId);
  if (!p) return s;
  if (left ? p.status !== 'waiting' : p.status !== 'left') return s;
  const text = left ? '自行離開' : '恢復待送';
  return {
    ...s,
    patients: s.patients.map((x) =>
      x.id === patientId
        ? { ...x, status: left ? ('left' as const) : ('waiting' as const), history: [...x.history, { at: now, action: text }] }
        : x,
    ),
    log: [...s.log, { at: now, text: `${p.label} ${text}` }],
  };
}
