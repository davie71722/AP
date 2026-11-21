import { describe, expect, it } from 'vitest';
import { initialRuntimes } from '../data/hospitals';
import { DEFAULT_SETTINGS, type Patient } from '../types';
import { applyChanges, dedupeLabels, emptyWire, Tracker, type Shared, type Wire } from './wire';

const pat = (id: string, num: number, at: number, extra: Partial<Patient> = {}): Patient => ({
  id,
  color: 'Y',
  label: `黃${num}`,
  num,
  prevLabels: [],
  seq: num,
  tags: [],
  status: 'waiting',
  history: [{ at, action: '新增' }],
  ...extra,
});

const shared = (patients: Patient[] = []): Shared => ({
  incident: { types: [], location: null, startAt: 1, settings: DEFAULT_SETTINGS, log: [] },
  patients,
  vehicles: [],
  runtime: initialRuntimes(),
  counters: { R: 0, Y: patients.length, G: 0, K: 0 },
  seq: patients.length,
});

/** 模擬一台裝置的一次同步：送出本機變更後採用伺服器狀態 */
function sync(t: Tracker, local: Shared, server: Wire, now: number): { local: Shared; server: Wire } {
  const c = t.collect(local, now);
  const next = applyChanges(server, c);
  t.markSent(c);
  return { local: t.adopt(local, next, c), server: next };
}

describe('多人同步合併', () => {
  it('兩人各改不同病人：兩邊的修改都保留', () => {
    let server = emptyWire();
    const a = new Tracker('A');
    const b = new Tracker('B');
    let la = shared([pat('p1', 1, 1), pat('p2', 2, 2)]);
    ({ local: la, server } = sync(a, la, server, 10));
    let lb = b.adopt(shared(), server, applyChanges(emptyWire(), a.collect(la, 0)) as never, true);
    expect(lb.patients.map((p) => p.id)).toEqual(['p1', 'p2']);

    // A 改 p1 註解、B 改 p2 狀態
    la = { ...la, patients: la.patients.map((p) => (p.id === 'p1' ? { ...p, note: 'A 的註解' } : p)) };
    lb = { ...lb, patients: lb.patients.map((p) => (p.id === 'p2' ? { ...p, status: 'sent' as const, hospitalId: 'h' } : p)) };
    ({ local: la, server } = sync(a, la, server, 20));
    ({ local: lb, server } = sync(b, lb, server, 21));
    ({ local: la, server } = sync(a, la, server, 22));
    for (const l of [la, lb]) {
      expect(l.patients.find((p) => p.id === 'p1')!.note).toBe('A 的註解');
      expect(l.patients.find((p) => p.id === 'p2')!.status).toBe('sent');
    }
  });

  it('同一病人兩人都改：較晚者為準', () => {
    let server = emptyWire();
    const a = new Tracker('A');
    const b = new Tracker('B');
    let la = shared([pat('p1', 1, 1)]);
    ({ local: la, server } = sync(a, la, server, 10));
    let lb = b.adopt(shared(), server, { patients: {}, vehicles: {}, runtime: {}, incident: {}, log: {}, counters: la.counters, seq: 0 }, true);
    la = { ...la, patients: [{ ...la.patients[0], note: '舊' }] };
    lb = { ...lb, patients: [{ ...lb.patients[0], note: '新' }] };
    ({ local: la, server } = sync(a, la, server, 30));
    ({ local: lb, server } = sync(b, lb, server, 31));
    ({ local: la, server } = sync(a, la, server, 32));
    expect(la.patients[0].note).toBe('新');
    expect(lb.patients[0].note).toBe('新');
  });

  it('刪除會同步；新增紀錄取聯集', () => {
    let server = emptyWire();
    const a = new Tracker('A');
    const b = new Tracker('B');
    let la = shared([pat('p1', 1, 1), pat('p2', 2, 2)]);
    la = { ...la, incident: { ...la.incident, log: [{ at: 5, text: '事件開始' }] } };
    ({ local: la, server } = sync(a, la, server, 10));
    let lb = b.adopt(shared(), server, { patients: {}, vehicles: {}, runtime: {}, incident: {}, log: {}, counters: la.counters, seq: 0 }, true);
    la = { ...la, patients: la.patients.filter((p) => p.id !== 'p2'), incident: { ...la.incident, log: [...la.incident.log, { at: 20, text: 'A 刪除' }] } };
    lb = { ...lb, incident: { ...lb.incident, log: [...lb.incident.log, { at: 21, text: 'B 派車' }] } };
    ({ local: la, server } = sync(a, la, server, 30));
    ({ local: lb, server } = sync(b, lb, server, 31));
    ({ local: la, server } = sync(a, la, server, 32));
    expect(lb.patients.map((p) => p.id)).toEqual(['p1']);
    expect(la.incident.log.map((l) => l.text)).toEqual(['事件開始', 'A 刪除', 'B 派車']);
    expect(lb.incident.log.map((l) => l.text)).toEqual(['事件開始', 'A 刪除', 'B 派車']);
  });

  it('同步後未再修改的物件不會被當成本機變更重送', () => {
    let server = emptyWire();
    const a = new Tracker('A');
    let la = shared([pat('p1', 1, 1)]);
    ({ local: la, server } = sync(a, la, server, 10));
    const c = a.collect(la, 20);
    expect(Object.keys(c.patients)).toEqual([]);
    expect(Object.keys(c.incident)).toEqual([]);
  });

  it('兩人同時新增造成重複代碼時，較晚者改號', () => {
    const r = dedupeLabels([pat('a', 3, 100), pat('b', 3, 101), pat('c', 1, 50)], { R: 0, Y: 3, G: 0, K: 0 });
    expect(r.changed).toBe(true);
    expect(r.patients.find((p) => p.id === 'a')!.num).toBe(3);
    expect(r.patients.find((p) => p.id === 'b')!.num).toBe(4);
    expect(r.counters.Y).toBe(4);
  });
});
