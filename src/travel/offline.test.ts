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
    expect(estimateMinutes(24.7, 121.2, 24.75, 121.1, ['五峰'])).toBeCloseTo(base + 20);
    expect(estimateMinutes(24.7, 121.2, 24.75, 121.1, ['尖石', '田埔'])).toBeCloseTo(base + 25);
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
    expect(txt).toContain('• 回報時間：');
    expect(txt).toContain('• 事件類型：化災＋火災');
    expect(txt).toContain('• 地點：湖口');
    expect(txt).toContain('• 事件經過：12 分');
    expect(txt).toContain('• 各院收治：東元醫院 紅1');
    expect(txt).toContain('• 待後送：綠1');
    // 沒有的事情不寫
    expect(txt).not.toContain('黃0');
    expect(txt).not.toContain('關閉醫院');
    expect(txt).not.toContain('自行離開');
  });
});
