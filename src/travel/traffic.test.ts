import { describe, expect, it } from 'vitest';
import { rushFactor, shoulderAdjust, timeFactor } from './traffic';

const at = (day: number, h: number, m = 0) => new Date(2026, 10, 16 + day, h, m); // 2026-11-16 為週一

describe('時段與救護車走路肩', () => {
  it('平日上下班尖峰 ×1.3、夜間 ×0.9、週末 ×1.0', () => {
    expect(rushFactor(at(0, 8))).toBe(1.3);
    expect(rushFactor(at(0, 18, 30))).toBe(1.3);
    expect(rushFactor(at(0, 9, 15))).toBe(1.15);
    expect(rushFactor(at(0, 23))).toBe(0.9);
    expect(rushFactor(at(5, 8))).toBe(1.0);
    expect(rushFactor(at(0, 13))).toBe(1.0);
  });
  it('長程（國道）尖峰只計部分延誤；短程全計；手動倍率優先', () => {
    expect(timeFactor(5, at(0, 8))).toBeCloseTo(1.3);
    expect(timeFactor(30, at(0, 8))).toBeCloseTo(1.105);
    expect(timeFactor(30, at(0, 8), 1.6)).toBe(1.6);
  });
  it('即時路況：長程延誤只計 35%', () => {
    expect(shoulderAdjust(1800, 1200, 30)).toBeCloseTo(1410);
    expect(shoulderAdjust(900, 600, 5)).toBe(900);
  });
});
