import { describe, expect, it } from 'vitest';
import { estimateMinutes, haversineKm } from './offline';
import { combineRules } from '../engine/rules';
import { buildReport } from '../report/report';
import { DEFAULT_SETTINGS } from '../types';

describe('離線車程估算', () => {
  it('haversine 約略正確（竹北→新竹約 4 km）', () => {
    expect(haversineKm(24.839, 121.004, 24.804, 120.968)).toBeGreaterThan(4);
    expect(haversineKm(24.839, 121.004, 24.804, 120.968)).toBeLessThan(6);
  });
  it('依距離分段速度並加山區加成', () => {
    const base = estimateMinutes(24.7, 121.2, 24.75, 121.1);
    expect(estimateMinutes(24.7, 121.2, 24.75, 121.1, ['尖石'])).toBeCloseTo(base + 20);
    // 同點：只剩固定 3 分
    expect(estimateMinutes(24.8, 121, 24.8, 121)).toBe(3);
  });
});

describe('規則包疊加', () => {
  it('聯集 dispatchRequires、全部 alerts、任一創傷即創傷', () => {
    const r = combineRules(['hazmat', 'fire', 'medical']);
    expect(r.dispatchRequires).toEqual(['decontaminated']);
    expect(r.vehicleAfterTransport).toBe('decon');
    expect(r.trauma).toBe(true);
    expect(r.alerts.length).toBeGreaterThanOrEqual(6);
    expect(combineRules(['medical']).trauma).toBe(false);
  });
});

describe('回報文字', () => {
  it('包含統計與各院收治', () => {
    const now = Date.now();
    const txt = buildReport(
      { types: ['hazmat', 'fire'], location: { kind: 'township', label: '湖口', lat: 0, lng: 0 }, startAt: now - 12 * 60000, settings: DEFAULT_SETTINGS, log: [] },
      [
        { id: 'a', color: 'R', label: '紅1', num: 1, prevLabels: [], seq: 1, tags: [], status: 'sent', hospitalId: 'tungyuan', history: [] },
        { id: 'b', color: 'G', label: '綠1', num: 1, prevLabels: [], seq: 2, tags: [], status: 'waiting', history: [] },
      ],
      [],
      {},
      now,
    );
    expect(txt).toContain('事件：化災＋火災｜地點：湖口');
    expect(txt).toContain('經過時間：12 分');
    expect(txt).toContain('東元 紅1');
    expect(txt).toContain('待後送：紅0 黃0 綠1');
  });
});
