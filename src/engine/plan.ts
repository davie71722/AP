// 分配演算引擎（規格書「六」）：時間模擬，只產出「建議」，不改變真實狀態。
import type {
  Cap,
  Hospital,
  HospitalRuntime,
  Patient,
  Settings,
  TransportColor,
  TravelEntry,
  Vehicle,
} from '../types';
import { RED_CLASS_ORDER } from '../types';
import { bonusApplies, missingRequirements, type CombinedRules } from './rules';
import { WEIGHTS, type FitClass } from './weights';

export interface PlanInput {
  now: number;
  patients: Patient[];
  vehicles: Vehicle[];
  hospitals: Hospital[];
  runtime: Record<string, HospitalRuntime>;
  travel: Record<string, TravelEntry>;
  settings: Settings;
  rules: CombinedRules;
}

export type WarningKind =
  | 'diverted' // 滿載轉向
  | 'longHaul' // 長程後送
  | 'crossCounty' // 跨縣市
  | 'hazmatHospital'; // 化災責任醫院

export interface Warning {
  kind: WarningKind;
  text: string;
}

export interface Suggestion {
  key: string;
  color: TransportColor;
  patientIds: string[];
  vehicleId: string;
  tripNo: number; // 第 N 趟（含已完成趟次）
  hospitalId: string;
  idealHospitalId: string;
  availableMin: number; // 車輛可用（距今分鐘）
  departMin: number;
  arriveMin: number;
  returnMin: number;
  goMin: number;
  backMin: number;
  score: number;
  confirmable: boolean;
  /** 車輛應已到場但狀態尚未改為待命 */
  needsArrivalMark: boolean;
  warnings: Warning[];
}

export type UnassignedReason = 'noVehicle' | 'noCapacity' | 'needsDecon';

export interface Unassigned {
  patientIds: string[];
  color: TransportColor;
  reason: UnassignedReason;
  detail: string;
}

export interface Plan {
  suggestions: Suggestion[];
  unassigned: Unassigned[];
  /** 被保留（不可抽調）的車 */
  reservedVehicleIds: string[];
  availableNow: number;
  clearMin: number | null; // 預估現場清空（最後一位出發）距今分鐘
  needReinforcement: boolean;
  /** 模擬量能（真實已用 + 建議中） */
  simulatedUse: Record<string, Cap>;
}

// ---------- 計分 ----------

export function capacityOf(h: Hospital, rt: HospitalRuntime | undefined, night: boolean): Cap {
  if (rt?.capacityOverride) return rt.capacityOverride;
  return night && h.capacityNight ? h.capacityNight : h.capacity;
}

export function fitClass(h: Hospital, color: TransportColor, trauma: boolean): FitClass {
  if (color === 'R' && trauma) {
    if (h.level === 'heavy') return 'heavy';
    if (h.traumaLevel === 'heavy') return WEIGHTS.redTraumaUsesTraumaLevel ? 'heavy' : 'mediumTraumaHeavy';
    if (h.traumaLevel === 'medium') return 'medium';
    return h.level === 'medium' ? 'medium' : 'general';
  }
  if (h.level === 'heavy') return 'heavy';
  if (h.level === 'medium') return trauma && h.traumaLevel === 'heavy' ? 'mediumTraumaHeavy' : 'medium';
  return 'general';
}

export function fitScore(h: Hospital, color: TransportColor, trauma: boolean): number {
  const cls = fitClass(h, color, trauma);
  if (color === 'Y' && cls === 'general' && trauma && h.traumaLevel === 'medium') {
    return WEIGHTS.yellowGeneralTraumaMedium;
  }
  return WEIGHTS.fit[color][cls];
}

/** 特殊加分：事件規則包與燒傷取最大值（不相加）；兒童、孕婦另計 */
export function specialBonus(
  h: Hospital,
  color: TransportColor,
  tags: string[],
  rules: CombinedRules,
): number {
  let maxPool = 0;
  for (const r of rules.bonuses) {
    if (bonusApplies(r, color, tags, h)) maxPool = Math.max(maxPool, r.value);
  }
  if (tags.includes('burn') && h.tags.includes('burn')) maxPool = Math.max(maxPool, WEIGHTS.burnTag);
  let extra = 0;
  if (tags.includes('peds')) {
    if (h.tags.includes('peds')) extra += WEIGHTS.pedsTag;
    else if (h.level === 'heavy') extra += WEIGHTS.pedsHeavyNoTag;
  }
  if (tags.includes('pregnant')) {
    if (h.level === 'heavy') extra += WEIGHTS.pregnantHeavy;
    if (h.tags.includes('obstetric')) extra += WEIGHTS.pregnantObstetric;
  }
  return maxPool + extra;
}

export function effectiveTravel(
  t: TravelEntry | undefined,
  rt: HospitalRuntime | undefined,
  settings: Settings,
): { go: number; back: number } | null {
  if (!t) return null;
  const factor = t.source === 'online' ? 1 : settings.trafficFactor;
  const adj = rt?.travelAdjustMin ?? 0;
  return {
    go: Math.max(1, t.go * factor + adj),
    back: Math.max(1, t.back * factor + adj),
  };
}

/** 化災時車輛每趟後是否需除污（預設否，可在設定開啟） */
export function vehicleNeedsDecon(rules: CombinedRules, settings: Settings): boolean {
  return rules.vehicleAfterTransport === 'decon' && settings.hazmatVehicleDecon;
}

// ---------- 車輛可用時間 ----------

export function vehicleAvailableMin(v: Vehicle, now: number): number | null {
  switch (v.status) {
    case 'standby':
      return 0;
    case 'enroute': {
      const elapsed = (now - v.addedAt) / 60000;
      return Math.max(0, (v.etaToSceneMin ?? 15) - elapsed);
    }
    case 'transport':
      // 化災：返場後須除污，模擬中不再可用
      if (v.contaminated) return null;
      return Math.max(0, ((v.returnAt ?? now) - now) / 60000);
    default:
      return null;
  }
}

// ---------- 主流程 ----------

interface Job {
  color: TransportColor;
  patients: Patient[];
  tags: string[];
}

interface SimVehicle {
  v: Vehicle;
  avail: number;
  trips: number;
  simTrips: number;
}

const COLOR_ORDER: Record<string, number> = { R: 0, Y: 1, G: 2 };

export function computePlan(input: PlanInput): Plan {
  const { now, patients, vehicles, hospitals, runtime, travel, settings, rules } = input;
  const deconAfter = vehicleNeedsDecon(rules, settings);

  // 1. 待送、非黑色，依紅→黃→綠、建立順序
  const waiting = patients
    .filter((p) => p.status === 'waiting' && p.color !== 'K')
    .sort(
      (a, b) =>
        COLOR_ORDER[a.color] - COLOR_ORDER[b.color] ||
        (a.color === 'R' ? (RED_CLASS_ORDER[a.redClass ?? ''] ?? 4) - (RED_CLASS_ORDER[b.redClass ?? ''] ?? 4) : 0) ||
        a.seq - b.seq,
    );

  const unassigned: Unassigned[] = [];

  // 2. dispatchRequires 未滿足 → 待處置
  const dispatchable: Patient[] = [];
  for (const p of waiting) {
    const miss = missingRequirements(p, rules);
    if (miss.length) {
      unassigned.push({
        patientIds: [p.id],
        color: p.color as TransportColor,
        reason: 'needsDecon',
        detail: miss.includes('decontaminated') ? '未除污，不可派車' : `缺少：${miss.join('、')}`,
      });
    } else dispatchable.push(p);
  }

  // 3. 綠傷分組
  const jobs: Job[] = [];
  const greens: Patient[] = [];
  for (const p of dispatchable) {
    if (p.color === 'G') greens.push(p);
    else jobs.push({ color: p.color as TransportColor, patients: [p], tags: p.tags });
  }
  for (let i = 0; i < greens.length; i += settings.greensPerVehicle) {
    const grp = greens.slice(i, i + settings.greensPerVehicle);
    jobs.push({ color: 'G', patients: grp, tags: Array.from(new Set(grp.flatMap((p) => p.tags))) });
  }

  // 4. 車輛可用時間、保留車數
  let pool: SimVehicle[] = [];
  for (const v of vehicles) {
    const a = vehicleAvailableMin(v, now);
    if (a !== null) pool.push({ v, avail: a, trips: v.trips, simTrips: 0 });
  }
  const reservedVehicleIds: string[] = [];
  if (settings.reserveVehicles > 0) {
    // 保留最晚可用的縣內車輛（優先保留尚未投入的）
    const county = pool
      .filter((s) => s.v.source === 'county')
      .sort((a, b) => b.avail - a.avail || a.trips - b.trips);
    for (const s of county.slice(0, settings.reserveVehicles)) reservedVehicleIds.push(s.v.id);
    pool = pool.filter((s) => !reservedVehicleIds.includes(s.v.id));
  }
  const availableNow = pool.filter((s) => s.avail <= WEIGHTS.onSceneToleranceMin && s.v.status === 'standby').length;

  // 8. 模擬量能（深拷貝）
  const simUsed: Record<string, Cap> = {};
  for (const h of hospitals) {
    const rt = runtime[h.id];
    simUsed[h.id] = {
      R: (rt?.used.R ?? 0) + (rt?.selfPresented.R ?? 0),
      Y: (rt?.used.Y ?? 0) + (rt?.selfPresented.Y ?? 0),
      G: (rt?.used.G ?? 0) + (rt?.selfPresented.G ?? 0),
    };
  }

  const scoreHospital = (h: Hospital, job: Job, go: number, ignoreLoad = false): number => {
    const c = job.color;
    const cap = capacityOf(h, runtime[h.id], settings.nightMode)[c];
    const loadRatio = ignoreLoad ? 0 : cap > 0 ? Math.min(1, simUsed[h.id][c] / cap) : 1;
    let s =
      fitScore(h, c, rules.trauma) -
      WEIGHTS.travel[c] * go -
      WEIGHTS.loadPenalty * loadRatio +
      specialBonus(h, c, job.tags, rules) +
      (WEIGHTS.countyBonus[c][h.county] ?? 0) +
      (c === 'R' && rules.trauma ? WEIGHTS.redPriorityHospitals[h.id] ?? 0 : 0);
    if (go >= settings.longHaulMin) s -= WEIGHTS.longHaul[c];
    return s;
  };

  const pick = (job: Job, respectCapacity: boolean) => {
    let best: { h: Hospital; score: number; go: number; back: number } | null = null;
    for (const h of hospitals) {
      const rt = runtime[h.id];
      if (rt?.bypass) continue;
      const tr = effectiveTravel(travel[h.id], rt, settings);
      if (!tr) continue;
      const cap = capacityOf(h, rt, settings.nightMode)[job.color];
      if (respectCapacity) {
        if (cap - simUsed[h.id][job.color] < job.patients.length) continue;
      } else if (cap <= 0) continue;
      const score = scoreHospital(h, job, tr.go, !respectCapacity);
      if (!best || score > best.score) best = { h, score, go: tr.go, back: tr.back };
    }
    return best;
  };

  const suggestions: Suggestion[] = [];
  let needReinforcement = false;

  for (const job of jobs) {
    const ids = job.patients.map((p) => p.id);
    if (pool.length === 0) {
      unassigned.push({ patientIds: ids, color: job.color, reason: 'noVehicle', detail: '無可用車輛' });
      if (job.color === 'R') needReinforcement = true;
      continue;
    }
    const chosen = pick(job, true);
    if (!chosen) {
      unassigned.push({ patientIds: ids, color: job.color, reason: 'noCapacity', detail: '無可收治醫院（量能不足或關閉）' });
      continue;
    }
    // 5. 最早可用的車；同時可用時趟次少者優先
    pool.sort((a, b) => a.avail - b.avail || a.trips + a.simTrips - (b.trips + b.simTrips));
    const sv = pool[0];
    const ideal = pick(job, false);

    // 7. 時間
    const departMin = sv.avail + settings.loadMin;
    const arriveMin = departMin + chosen.go;
    const returnMin = arriveMin + settings.handoverMin + chosen.back;

    const h = chosen.h;
    const warnings: Warning[] = [];
    if (ideal && ideal.h.id !== h.id) warnings.push({ kind: 'diverted', text: `滿載轉向（原首選 ${ideal.h.short}）` });
    if (chosen.go >= settings.longHaulMin) {
      warnings.push({ kind: 'longHaul', text: `長程後送：車離場約 ${Math.round(returnMin - departMin)} 分` });
    }
    if (h.county !== '新竹縣' && h.county !== '新竹市') warnings.push({ kind: 'crossCounty', text: `跨縣市（${h.county}）` });
    if (h.tags.includes('hazmat')) warnings.push({ kind: 'hazmatHospital', text: '化災責任醫院' });

    const onScene = sv.simTrips === 0 && sv.avail <= WEIGHTS.onSceneToleranceMin;
    suggestions.push({
      key: `${ids.join('+')}@${sv.v.id}#${sv.trips + sv.simTrips}`,
      color: job.color,
      patientIds: ids,
      vehicleId: sv.v.id,
      tripNo: sv.trips + sv.simTrips + 1,
      hospitalId: h.id,
      idealHospitalId: ideal?.h.id ?? h.id,
      availableMin: sv.avail,
      departMin,
      arriveMin,
      returnMin,
      goMin: chosen.go,
      backMin: chosen.back,
      score: chosen.score,
      confirmable: onScene && sv.v.status === 'standby',
      needsArrivalMark: onScene && sv.v.status === 'enroute',
      warnings,
    });

    simUsed[h.id][job.color] += job.patients.length;
    sv.simTrips += 1;
    if (deconAfter) {
      // 化災：車輛返場後需除污，模擬中不再派用
      pool = pool.filter((x) => x !== sv);
    } else {
      sv.avail = returnMin;
    }
  }

  const clearMin = suggestions.length ? Math.max(...suggestions.map((s) => s.departMin)) : null;

  return {
    suggestions,
    unassigned,
    reservedVehicleIds,
    availableNow,
    clearMin,
    needReinforcement,
    simulatedUse: simUsed,
  };
}
