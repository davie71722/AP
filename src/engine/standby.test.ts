import { describe, expect, it } from 'vitest';
import { HOSPITALS, initialRuntimes } from '../data/hospitals';
import { TOWNSHIPS } from '../data/places';
import { offlineTravel } from '../travel';
import { DEFAULT_SETTINGS, dispatchOrder, injuryText, standbyMin, type Patient, type Vehicle } from '../types';
import { setPolice, setTrapped, setVehicleStatus, type DomainState } from './actions';
import { computePlan } from './plan';
import { combineRules } from './rules';

const NOW = new Date(2026, 10, 22, 14, 0).getTime();
const MIN = 60000;

function V(id: string, extra: Partial<Vehicle> = {}): Vehicle {
  return { id, name: id, unit: '竹北', source: 'county', originLat: 24.839, originLng: 121.004, status: 'standby', addedAt: NOW - 60 * MIN, trips: 0, emt2: 2, emtp: 0, ...extra };
}
function P(id: string, extra: Partial<Patient> = {}): Patient {
  return { id, color: 'R', label: `紅${id}`, num: 1, prevLabels: [], seq: 1, tags: [], status: 'waiting', history: [{ at: NOW, action: '新增' }], ...extra };
}
const dom = (vehicles: Vehicle[], patients: Patient[] = []): DomainState => ({ patients, vehicles, runtime: initialRuntimes(), log: [] });

describe('車輛依待命時間排序', () => {
  it('到場、返場、除污完成、恢復待命都會設定 standbySince', () => {
    let d = dom([V('a', { status: 'enroute' }), V('b', { status: 'transport' }), V('c', { status: 'decon', contaminated: true }), V('d', { status: 'offline' })]);
    for (const id of ['a', 'b', 'c', 'd']) d = setVehicleStatus(d, id, 'standby', NOW);
    expect(d.vehicles.map((v) => v.standbySince)).toEqual([NOW, NOW, NOW, NOW]);
  });
  it('已待命再標一次不重設；污染車返場轉待除污不設定', () => {
    let d = dom([V('a', { standbySince: NOW - 10 * MIN }), V('b', { status: 'transport', contaminated: true })]);
    d = setVehicleStatus(d, 'a', 'standby', NOW);
    d = setVehicleStatus(d, 'b', 'standby', NOW);
    expect(d.vehicles[0].standbySince).toBe(NOW - 10 * MIN);
    expect(d.vehicles[1].status).toBe('decon');
    expect(d.vehicles[1].standbySince).toBeUndefined();
  });
  it('待命最久者在前、趕赴中其次、留守車（可多輛）最後', () => {
    const vs = [
      V('held1', { held: true, standbySince: NOW - 50 * MIN }),
      V('new', { standbySince: NOW - 2 * MIN }),
      V('enr', { status: 'enroute', addedAt: NOW, etaToSceneMin: 5 }),
      V('old', { standbySince: NOW - 20 * MIN }),
      V('held2', { held: true, standbySince: NOW - 40 * MIN }),
      V('tr', { status: 'transport' }),
    ];
    expect(dispatchOrder(vs).map((v) => v.id)).toEqual(['old', 'new', 'enr', 'held1', 'held2']);
    expect(standbyMin(vs[3], NOW)).toBe(20);
  });
  it('派遣建議優先使用待命最久的車', () => {
    const [lat, lng] = TOWNSHIPS['竹北'];
    const plan = computePlan({
      now: NOW,
      patients: [P('1')],
      vehicles: [V('new', { standbySince: NOW - 1 * MIN }), V('old', { standbySince: NOW - 30 * MIN, trips: 2 })],
      hospitals: HOSPITALS,
      runtime: initialRuntimes(),
      travel: offlineTravel({ kind: 'township', label: '竹北', lat, lng, township: '竹北' }),
      settings: { ...DEFAULT_SETTINGS, firstVehicleHold: false },
      rules: combineRules(['traffic']),
      area: '竹北',
    });
    expect(plan.suggestions[0].vehicleId).toBe('old');
  });
});

describe('受困／脫困', () => {
  it('受困中不列入派遣建議', () => {
    const [lat, lng] = TOWNSHIPS['竹北'];
    const plan = computePlan({
      now: NOW,
      patients: [P('1', { trapped: true })],
      vehicles: [V('a')],
      hospitals: HOSPITALS,
      runtime: initialRuntimes(),
      travel: offlineTravel({ kind: 'township', label: '竹北', lat, lng, township: '竹北' }),
      settings: { ...DEFAULT_SETTINGS, firstVehicleHold: false },
      rules: combineRules(['traffic']),
      area: '竹北',
    });
    expect(plan.suggestions).toHaveLength(0);
    expect(plan.unassigned[0].reason).toBe('trapped');
  });
  it('脫困記錄時間，寫入案件經過與交接註解', () => {
    let d = dom([], [P('1-A', { trauma: [{ id: 'r-crush', name: '壓砸傷', acts: [] }] })]);
    d = setTrapped(d, '1-A', true, NOW);
    expect(d.patients[0].trapped).toBe(true);
    expect(injuryText(d.patients[0])).toMatch(/^受困中。/);
    d = setTrapped(d, '1-A', false, NOW + 12 * MIN);
    expect(d.patients[0].trapped).toBe(false);
    expect(d.patients[0].extricatedAt).toBe(NOW + 12 * MIN);
    expect(d.log.map((l) => l.text)).toEqual(['紅1-A 受困中', '紅1-A 已脫困 14:12']);
    expect(injuryText(d.patients[0])).toMatch(/^受困，14:12 脫困。壓砸傷/);
  });
});

describe('黑牌移交警方', () => {
  it('記錄移交時間，非黑牌不適用', () => {
    let d = dom([], [P('k', { color: 'K', label: '黑1' }), P('r')]);
    d = setPolice(d, 'k', true, NOW);
    d = setPolice(d, 'r', true, NOW);
    expect(d.patients[0].policeAt).toBe(NOW);
    expect(d.patients[1].policeAt).toBeUndefined();
    expect(d.log.map((l) => l.text)).toEqual(['黑1 已移交警方 14:00']);
  });
});
