import { describe, expect, it } from 'vitest';
import { initialRuntimes } from '../data/hospitals';
import { DEFAULT_SETTINGS, type Incident, type Patient, type Vehicle } from '../types';
import { buildReport, buildSummary, headcount, headcountText, hospitalNotice } from './report';

const T = (h: number, m: number) => new Date(2026, 10, 21, h, m).getTime();
const P = (id: string, color: Patient['color'], num: number, extra: Partial<Patient> = {}): Patient => ({
  id,
  color,
  label: `${{ R: '紅', Y: '黃', G: '綠', K: '黑' }[color]}${num}`,
  num,
  prevLabels: [],
  seq: num,
  tags: [],
  status: 'waiting',
  history: [],
  ...extra,
});

describe('案件總結', () => {
  it('條列、沒有的不寫，含傷患明細', () => {
    const incident: Incident = {
      types: ['traffic'],
      location: { kind: 'pin', label: '竹北 24.82, 121.02', lat: 24.82, lng: 121.02 },
      startAt: T(14, 0),
      endAt: T(15, 10),
      settings: DEFAULT_SETTINGS,
      log: [{ at: T(14, 5), text: '⚠ 特殊事件｜檢傷升級為紅傷：黃1 → 紅2-B' }],
      milestones: { 大隊抵達: T(14, 12) },
    };
    const v: Vehicle = { id: 'v1', name: '竹北91', unit: '竹北', source: 'county', originLat: 0, originLng: 0, status: 'transport', addedAt: T(14, 3), trips: 1, emt2: 2, emtp: 0 } as Vehicle;
    const patients = [
      P('a', 'R', 1, { redClass: 'A', label: '紅1-A', status: 'sent', hospitalId: 'tungyuan', vehicleId: 'v1', sentAt: T(14, 20), trauma: [{ id: 'r-pelvis', name: '不穩定骨盆骨折', acts: ['骨盆固定帶固定'] }] }),
      P('b', 'G', 1, { status: 'left' }),
      P('c', 'Y', 2),
    ];
    const s = buildSummary(incident, patients, [v], initialRuntimes(), T(15, 30));
    expect(s).toContain('• 結束時間：2026/11/21 15:10');
    expect(s).toContain('• 時間軸：開始 14:00、大隊抵達 14:12、首車出發 14:20、結束 15:10（歷時 70 分）');
    expect(s).toContain('• 傷患總數：3（1紅 1黃 1綠）');
    expect(s).toContain('• 自行離開：1（綠1）');
    expect(s).toContain('• 未後送：1（黃2）');
    expect(s).toContain('• 檢傷升級為紅傷：1 位（黃1 → 紅2-B）');
    expect(s).toContain('• 各院收治：東元醫院 1紅（紅1-A）');
    expect(s).toContain('• 救護車：1 台、共 1 趟（竹北91 1趟）');
    expect(s).toContain('紅1-A｜竹北91 14:20 ➔ 東元醫院｜不穩定骨盆骨折；處置予骨盆固定帶固定。');
    expect(s).not.toContain('關閉醫院');
    expect(s).not.toContain('勤務車／群送');
  });
});

describe('人數核對、受困、通報醫院', () => {
  const incident: Incident = { types: ['traffic'], location: null, startAt: T(14, 0), endAt: null, settings: DEFAULT_SETTINGS, log: [] };
  const v = { id: 'v1', name: '竹北91' } as Vehicle;
  const ps = [
    P('a', 'R', 1, { redClass: 'A', label: '紅1-A', status: 'sent', hospitalId: 'tungyuan', vehicleId: 'v1', sentAt: T(14, 20), arriveAt: T(14, 32), extricatedAt: T(14, 15) }),
    P('b', 'G', 1, { status: 'left' }),
    P('c', 'Y', 2, { trapped: true }),
    P('d', 'K', 1),
  ];
  it('總數＝已送＋離開＋待送＋黑', () => {
    expect(headcountText(ps)).toBe('4＝已送 1＋離開 1＋待送 1＋黑 1 ✔');
    expect(headcount(ps).ok).toBe(true);
  });
  it('回報與總結列出受困', () => {
    expect(buildReport(incident, ps, [v], initialRuntimes(), T(14, 40))).toContain('• 受困中：黃2');
    const s = buildSummary(incident, ps, [v], initialRuntimes(), T(14, 40));
    expect(s).toContain('• 受困：2（紅1-A 14:15 脫困、黃2 受困中）');
    expect(s).toContain('• 人數核對：4＝已送 1＋離開 1＋待送 1＋黑 1 ✔');
    expect(s).toContain('紅1-A｜竹北91 14:20 ➔ 東元醫院｜受困，14:15 脫困。');
  });
  it('每趟通報醫院文字', () => {
    const t = hospitalNotice([ps[0]], v, incident);
    expect(t).toBe(
      ['【MCI 後送通報｜東元醫院】', '• 車號：竹北91', '• 事件類型：車禍', '• 出發：14:20', '• 預估抵院：14:32', '• 人數：1（紅1）', '• 紅1-A：受困，14:15 脫困。'].join('\n'),
    );
  });
});
