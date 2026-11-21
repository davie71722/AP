// 時段與救護車走路肩：事件發生當下估算車程
//
// 一般道路依時段調整；路程超過 SHOULDER_KM（多為國道／快速道路）時，
// 救護車可走路肩，壅塞延誤只計 SHOULDER_SHARE。

export const SHOULDER_KM = 10;
export const SHOULDER_SHARE = 0.35;

/** 時段係數（依裝置當地時間） */
export function rushFactor(at: Date): number {
  const m = at.getHours() * 60 + at.getMinutes();
  if (m >= 22 * 60 || m < 6 * 60) return 0.9; // 夜間
  const day = at.getDay();
  if (day === 0 || day === 6) return 1.0; // 週末
  const inR = (a: number, b: number) => m >= a && m < b;
  if (inR(7 * 60, 9 * 60) || inR(17 * 60, 19 * 60)) return 1.3; // 上下班尖峰
  if (inR(6 * 60 + 30, 7 * 60) || inR(9 * 60, 9 * 60 + 30) || inR(16 * 60 + 30, 17 * 60) || inR(19 * 60, 19 * 60 + 30)) return 1.15;
  return 1.0;
}

export function trafficLabel(at: Date): string {
  const f = rushFactor(at);
  if (f >= 1.3) return '尖峰';
  if (f > 1) return '近尖峰';
  if (f < 1) return '夜間';
  return '離峰';
}

/** 車程係數：manual > 0 為手動倍率；否則依時段，長程（國道）壅塞延誤只計部分（走路肩） */
export function timeFactor(km: number, at: Date, manual = 0): number {
  if (manual > 0) return manual;
  const f = rushFactor(at);
  if (f > 1 && km > SHOULDER_KM) return 1 + (f - 1) * SHOULDER_SHARE;
  return f;
}

/** 即時車程（含路況）：長程壅塞延誤只計部分（走路肩） */
export function shoulderAdjust(trafficSec: number, staticSec: number, km: number): number {
  const delay = Math.max(0, trafficSec - staticSec);
  return staticSec + delay * (km > SHOULDER_KM ? SHOULDER_SHARE : 1);
}
