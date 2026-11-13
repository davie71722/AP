import { describe, expect, it } from 'vitest';
import { HOSPITALS, HOSPITAL_BY_ID, initialRuntimes } from '../data/hospitals';
import { TOWNSHIPS } from '../data/places';
import { offlineTravel } from '../travel';
import { DEFAULT_SETTINGS, type Color, type IncidentLocation, type Patient, type Settings, type Vehicle } from '../types';
import { confirmDispatch, hazmatNotifyList, setVehicleStatus, type DomainState } from './actions';
import { computePlan, type PlanInput } from './plan';
import { combineRules } from './rules';

const NOW = 1_700_000_000_000;

function loc(t: string): IncidentLocation {
  const [lat, lng] = TOWNSHIPS[t];
  return { kind: 'township', label: t, lat, lng, township: t };
}

let seq = 0;
function patient(color: Color, tags: string[] = []): Patient {
  seq += 1;
  return { id: `p${seq}`, color, label: `${color}${seq}`, prevLabels: [], seq, tags, status: 'waiting', history: [] };
}
function patients(spec: Partial<Record<Color, number>>, tags: string[] = []): Patient[] {
  const out: Patient[] = [];
  for (const c of ['R', 'Y', 'G', 'K'] as Color[]) for (let i = 0; i < (spec[c] ?? 0); i++) out.push(patient(c, tags));
  return out;
}
function vehicle(i: number, status: Vehicle['status'] = 'standby'): Vehicle {
  return {
    id: `v${i}`,
    name: `竹北${90 + i}`,
    unit: '竹北',
    source: 'county',
    originLat: 24.839,
    originLng: 121.004,
    status,
    addedAt: NOW,
    trips: 0,
    emt2: 2,
    emtp: 0,
  };
}
function vehicles(n: number): Vehicle[] {
  return Array.from({ length: n }, (_, i) => vehicle(i + 1));
}

function input(over: Partial<Omit<PlanInput, 'settings'>> & { types?: string[]; at?: string; settings?: Partial<Settings> }): PlanInput {
  return {
    now: NOW,
    patients: over.patients ?? [],
    vehicles: over.vehicles ?? vehicles(40),
    hospitals: HOSPITALS,
    runtime: over.runtime ?? initialRuntimes(),
    travel: over.travel ?? offlineTravel(loc(over.at ?? '竹北')),
    settings: { ...DEFAULT_SETTINGS, ...over.settings },
    rules: combineRules(over.types ?? ['traffic']),
  };
}

const short = (id: string) => HOSPITAL_BY_ID[id].short;

describe('紅傷轉向順序', () => {
  it('紅傷優先送中醫大新竹（即使東元有量能）', () => {
    for (const at of ['竹北', '湖口', '竹東', '新埔']) {
      const plan = computePlan(input({ at, patients: patients({ R: 1 }) }));
      expect(short(plan.suggestions[0].hospitalId)).toBe('中醫大新竹');
    }
  });

  it('紅傷先填滿新竹縣與新竹市適合醫院，才送桃園、苗栗', () => {
    const plan = computePlan(input({ patients: patients({ R: 20 }) }));
    const hs = plan.suggestions.map((s) => s.hospitalId);
    const firstOut = hs.findIndex((id) => !['新竹縣', '新竹市'].includes(HOSPITAL_BY_ID[id].county));
    // 東元4 + 中醫大3 + 台大新竹4 + 馬偕4 = 15
    expect(firstOut).toBe(15);
  });

  it('新竹縣重度量能用盡後，紅傷依序轉向中醫大新竹 → 新竹市重度 → 為恭／林口', () => {
    const runtime = initialRuntimes();
    runtime['tungyuan'].used.R = 4; // 東元已滿
    const plan = computePlan(input({ patients: patients({ R: 12 }), runtime }));
    const hs = plan.suggestions.map((s) => short(s.hospitalId));
    // 第一位轉向中醫大新竹
    expect(hs[0]).toBe('中醫大新竹');
    expect(hs).not.toContain('東元');
    // 首次出現順序：中醫大新竹 → 新竹市重度級 → 為恭／林口
    const firstSeen = (h: string) => hs.indexOf(h);
    const out = ['為恭', '林口長庚', '部立桃園', '大千'];
    const firstOut = hs.findIndex((h) => out.includes(h));
    expect(firstOut).toBeGreaterThan(0);
    expect(firstSeen('台大新竹')).toBeGreaterThan(firstSeen('中醫大新竹'));
    expect(firstSeen('台大新竹')).toBeLessThan(firstOut);
    expect(firstSeen('新竹馬偕')).toBeLessThan(firstOut);
    // 紅傷不送中度／一般級
    for (const h of hs) expect(['中醫大新竹', '台大新竹', '新竹馬偕', ...out]).toContain(h);
    expect(['為恭', '林口長庚']).toContain(hs[firstOut]);
  });

  it('中醫大新竹也滿時，下一位紅傷送新竹市重度級', () => {
    const runtime = initialRuntimes();
    runtime['tungyuan'].used.R = 4;
    runtime['cmuh-hc'].used.R = 3;
    const plan = computePlan(input({ patients: patients({ R: 1 }), runtime }));
    expect(['台大新竹', '新竹馬偕']).toContain(short(plan.suggestions[0].hospitalId));
    expect(plan.suggestions[0].warnings.map((w) => w.kind)).not.toContain('crossCounty');
  });

  it('量能不足而轉向時標示「滿載轉向」', () => {
    const runtime = initialRuntimes();
    runtime['tungyuan'].used.R = 4;
    runtime['cmuh-hc'].used.R = 3;
    runtime['ntu-hc'].used.R = 4;
    runtime['mackay-hc'].used.R = 4;
    const plan = computePlan(input({ patients: patients({ R: 1 }), runtime }));
    const s = plan.suggestions[0];
    expect(short(s.hospitalId)).toBe('為恭');
    // 首選（不計量能）為較近的重度級
    expect(s.idealHospitalId).not.toBe(s.hospitalId);
    expect(s.warnings.map((w) => w.kind)).toEqual(expect.arrayContaining(['diverted', 'crossCounty']));
  });
});

describe('化災事件', () => {
  it('黃傷優先東元、湖口仁慈', () => {
    const plan = computePlan(
      input({ types: ['hazmat'], at: '湖口', patients: patients({ Y: 4 }, ['decontaminated']) }),
    );
    const hs = plan.suggestions.map((s) => short(s.hospitalId));
    expect(hs).toHaveLength(4);
    for (const h of hs) expect(['東元', '湖口仁慈']).toContain(h);
    expect(plan.suggestions[0].warnings.map((w) => w.kind)).toContain('hazmatHospital');
  });

  it('未除污傷患不出現在建議中', () => {
    const ps = [patient('Y'), patient('Y', ['decontaminated'])];
    const plan = computePlan(input({ types: ['hazmat', 'fire'], at: '湖口', patients: ps }));
    expect(plan.suggestions.flatMap((s) => s.patientIds)).toEqual([ps[1].id]);
    expect(plan.unassigned).toHaveLength(1);
    expect(plan.unassigned[0]).toMatchObject({ reason: 'needsDecon', patientIds: [ps[0].id] });
  });

  it('預設：化災運送後車輛不需除污，可折返多趟', () => {
    const rules = combineRules(['hazmat']);
    const ps = patients({ Y: 3 }, ['decontaminated']);
    const vs = [vehicle(1)];
    const inp = input({ types: ['hazmat'], at: '湖口', patients: ps, vehicles: vs });
    const plan = computePlan(inp);
    expect(plan.suggestions.map((s) => s.tripNo)).toEqual([1, 2, 3]);
    const st = confirmDispatch({ patients: ps, vehicles: vs, runtime: inp.runtime, log: [] }, plan.suggestions[0], NOW, inp.settings, rules);
    expect(st.vehicles[0].contaminated).toBeFalsy();
    expect(setVehicleStatus(st, 'v1', 'standby', NOW + 3600_000).vehicles[0].status).toBe('standby');
  });

  it('開啟「每趟需除污」：運送後車輛返場轉為待除污，解除後才可再用', () => {
    const rules = combineRules(['hazmat']);
    const ps = patients({ Y: 1 }, ['decontaminated']);
    const vs = [vehicle(1)];
    const inp = input({ types: ['hazmat'], at: '湖口', patients: ps, vehicles: vs, settings: { hazmatVehicleDecon: true } });
    const plan = computePlan(inp);
    expect(plan.suggestions[0].confirmable).toBe(true);
    let st: DomainState = { patients: ps, vehicles: vs, runtime: inp.runtime, log: [] };
    st = confirmDispatch(st, plan.suggestions[0], NOW, inp.settings, rules);
    expect(st.vehicles[0]).toMatchObject({ status: 'transport', contaminated: true, trips: 1 });
    expect(st.patients[0].status).toBe('sent');
    expect(st.runtime[plan.suggestions[0].hospitalId].used.Y).toBe(1);

    // 運送中、已污染：不列入可用
    const more = patients({ Y: 1 }, ['decontaminated']);
    const p2 = computePlan({ ...inp, patients: [...st.patients, ...more], vehicles: st.vehicles, runtime: st.runtime });
    expect(p2.suggestions).toHaveLength(0);
    expect(p2.unassigned[0].reason).toBe('noVehicle');

    st = setVehicleStatus(st, 'v1', 'standby', NOW + 3600_000);
    expect(st.vehicles[0].status).toBe('decon');
    st = setVehicleStatus(st, 'v1', 'standby', NOW + 3700_000);
    expect(st.vehicles[0]).toMatchObject({ status: 'standby', contaminated: false });
  });

  it('中途加入化災：標示已送出、未除污且送往無除污能力醫院者', () => {
    const runtime = initialRuntimes();
    const sent: Patient[] = [
      { ...patient('R'), status: 'sent', hospitalId: 'ntu-hc' },
      { ...patient('Y'), status: 'sent', hospitalId: 'tungyuan' }, // 東元預設具除污能力
    ];
    const list = hazmatNotifyList(sent, runtime);
    expect(list).toEqual([{ hospitalId: 'ntu-hc', labels: [sent[0].label] }]);
  });
});

describe('車輛折返', () => {
  it('3 台車、8 位傷患：產生第 2、3 趟折返', () => {
    const plan = computePlan(
      input({ patients: patients({ R: 2, Y: 3, G: 3 }), vehicles: vehicles(3), settings: { greensPerVehicle: 1 } }),
    );
    expect(plan.suggestions).toHaveLength(8);
    const trips = plan.suggestions.map((s) => s.tripNo);
    expect(trips.filter((t) => t === 1)).toHaveLength(3);
    expect(trips).toContain(2);
    expect(trips).toContain(3);
    // 同一台車的下一趟出發時間 ≥ 上一趟返場
    for (const v of ['v1', 'v2', 'v3']) {
      const mine = plan.suggestions.filter((s) => s.vehicleId === v);
      for (let i = 1; i < mine.length; i++) {
        expect(mine[i].departMin).toBeGreaterThanOrEqual(mine[i - 1].returnMin + DEFAULT_SETTINGS.loadMin - 1e-9);
      }
    }
    // 只有第一趟可確認，其餘為預排
    expect(plan.suggestions.filter((s) => s.confirmable)).toHaveLength(3);
  });

  it('趕赴中車輛依 ETA 排入，到場前不可確認', () => {
    const v = { ...vehicle(1, 'enroute'), etaToSceneMin: 12 };
    const plan = computePlan(input({ patients: patients({ R: 1 }), vehicles: [v] }));
    expect(plan.suggestions[0].availableMin).toBeCloseTo(12);
    expect(plan.suggestions[0].confirmable).toBe(false);
  });

  it('保留車數不納入派遣', () => {
    const plan = computePlan(
      input({ patients: patients({ Y: 3 }), vehicles: vehicles(3), settings: { reserveVehicles: 1 } }),
    );
    expect(plan.reservedVehicleIds).toHaveLength(1);
    expect(new Set(plan.suggestions.map((s) => s.vehicleId)).size).toBe(2);
  });
});

describe('醫院關閉與綠傷', () => {
  it('醫院手動關閉後立即重算', () => {
    const ps = patients({ R: 1 });
    const before = computePlan(input({ patients: ps }));
    const first = before.suggestions[0].hospitalId;
    const runtime = initialRuntimes();
    runtime[first].bypass = true;
    const after = computePlan(input({ patients: ps, runtime }));
    expect(after.suggestions[0].hospitalId).not.toBe(first);
  });

  it('綠傷不會被分到重度級', () => {
    const plan = computePlan(input({ patients: patients({ G: 30 }), settings: { greensPerVehicle: 1 } }));
    for (const s of plan.suggestions) expect(HOSPITAL_BY_ID[s.hospitalId].level).not.toBe('heavy');
  });

  it('綠傷只有在其他醫院皆滿時才送重度級', () => {
    const runtime = initialRuntimes();
    for (const h of HOSPITALS) if (h.level !== 'heavy') runtime[h.id].bypass = true;
    const plan = computePlan(input({ patients: patients({ G: 1 }), runtime }));
    expect(HOSPITAL_BY_ID[plan.suggestions[0].hospitalId].level).toBe('heavy');
  });

  it('綠傷依每車人數分組送同一家', () => {
    const plan = computePlan(input({ patients: patients({ G: 5 }), settings: { greensPerVehicle: 2 } }));
    expect(plan.suggestions.map((s) => s.patientIds.length)).toEqual([2, 2, 1]);
  });

  it('自行到院人數扣除量能', () => {
    const runtime = initialRuntimes();
    runtime['renci'].selfPresented.G = 10;
    const plan = computePlan(input({ at: '湖口', patients: patients({ G: 2 }), runtime }));
    expect(plan.suggestions[0].hospitalId).not.toBe('renci');
  });

  it('黑色傷患不派遣', () => {
    const plan = computePlan(input({ patients: patients({ K: 2 }) }));
    expect(plan.suggestions).toHaveLength(0);
    expect(plan.unassigned).toHaveLength(0);
  });
});

describe('特殊族群', () => {
  it('兒童紅傷偏好具兒科標籤醫院', () => {
    const plan = computePlan(input({ at: '寶山', patients: patients({ R: 1 }, ['peds']) }));
    expect(short(plan.suggestions[0].hospitalId)).toBe('新竹馬偕');
  });
});
