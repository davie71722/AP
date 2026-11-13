// 離線靜態車程估算（規格書 7.2）
import { MOUNTAIN_BONUS } from '../data/places';

export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/**
 * 基礎估算分鐘（未乘交通倍率、未含醫院人工修正）
 * @param mountainTownships 起訖點所在鄉鎮；取其中最大的山區加成
 */
export function estimateMinutes(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
  mountainTownships: (string | undefined)[] = [],
): number {
  const km = haversineKm(aLat, aLng, bLat, bLng) * 1.35;
  const speed = km > 25 ? 65 : km >= 10 ? 50 : 35;
  const bonus = Math.max(0, ...mountainTownships.map((t) => (t ? MOUNTAIN_BONUS[t] ?? 0 : 0)));
  return 3 + (km / speed) * 60 + bonus;
}
