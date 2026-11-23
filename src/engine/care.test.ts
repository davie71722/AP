import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, type Patient } from '../types';
import { markReassessed } from './actions';
import { initialRuntimes } from '../data/hospitals';
import { clockToMs, reassessDue, tourniquets } from './care';

const NOW = new Date(2026, 10, 23, 15, 30).getTime();
const MIN = 60000;
const P = (extra: Partial<Patient> = {}): Patient => ({
  id: 'p', color: 'R', label: '紅1-A', num: 1, prevLabels: [], seq: 1, tags: [], status: 'waiting', history: [{ at: NOW - 20 * MIN, action: '新增' }], ...extra,
});

describe('止血帶時間警示', () => {
  it('依上止血帶時間計算經過分鐘：60 分警示、120 分警報', () => {
    const p = P({ trauma: [{ id: 'r-amp', name: '創傷性截肢', sides: ['右下肢'], acts: ['已上止血帶(14:20)'] }, { id: 'r-art', name: '動脈大出血', sides: ['左上肢'], acts: ['已上止血帶(13:10)'] }] });
    const t = tourniquets(p, NOW);
    expect(t.map((x) => [x.side, x.min, x.level])).toEqual([
      ['右下肢', 70, 'warn'],
      ['左上肢', 140, 'alert'],
    ]);
    expect(tourniquets(P({ trauma: [{ id: 'r-amp', name: 'x', acts: ['已上止血帶(15:00)'] }] }), NOW)[0].level).toBe('ok');
  });
  it('跨午夜：23:50 上、00:30 看為 40 分', () => {
    const now = new Date(2026, 10, 24, 0, 30).getTime();
    expect((now - clockToMs('23:50', now)!) / MIN).toBe(40);
  });
});

describe('再評估計時', () => {
  it('預設關閉', () => {
    expect(reassessDue(P(), DEFAULT_SETTINGS, NOW)).toBeNull();
  });
  it('開啟時：紅傷 15 分、自檢傷起算；再評估後重新計時；已送出不需要', () => {
    const S = { ...DEFAULT_SETTINGS, reassessOn: true };
    expect(reassessDue(P(), S, NOW)).toBe(-5);
    expect(reassessDue(P({ color: 'Y' }), S, NOW)).toBe(10);
    expect(reassessDue(P({ color: 'K' }), S, NOW)).toBeNull();
    expect(reassessDue(P({ status: 'sent' }), S, NOW)).toBeNull();
    const d = markReassessed({ patients: [P()], vehicles: [], runtime: initialRuntimes(), log: [] }, 'p', NOW);
    expect(d.patients[0].reassessedAt).toBe(NOW);
    expect(reassessDue(d.patients[0], S, NOW)).toBe(15);
    expect(d.log[0].text).toBe('紅1-A 再評估 15:30');
  });
});
