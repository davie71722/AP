// 事發地點輸入解析：座標、Google 地圖連結（含座標者可離線解析）
import { nearestArea } from './places';
import type { IncidentLocation } from '../types';

const inTaiwan = (lat: number, lng: number) => lat > 21 && lat < 26.5 && lng > 118 && lng < 123;

/** 從文字取出座標：支援「24.83, 121.01」、Google 地圖網址的 @、q=、query=、!3d…!4d… */
export function parseCoords(text: string): { lat: number; lng: number } | null {
  const t = text.trim();
  // 地圖網址中的地標座標優先於視窗中心（@）
  const pin = t.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (pin) return check(+pin[1], +pin[2]);
  const m = t.match(/(-?\d{2,3}\.\d+)\s*[,，\s]\s*\+?(-?\d{2,3}\.\d+)/);
  if (m) return check(+m[1], +m[2]);
  return null;
}

function check(a: number, b: number) {
  if (inTaiwan(a, b)) return { lat: a, lng: b };
  if (inTaiwan(b, a)) return { lat: b, lng: a };
  return null;
}

export function isMapsShortLink(text: string): boolean {
  return /^https?:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps)\//i.test(text.trim());
}

export function isUrl(text: string): boolean {
  return /^https?:\/\//i.test(text.trim());
}

export function pinLocation(lat: number, lng: number, label?: string): IncidentLocation {
  const { township, area } = nearestArea(lat, lng);
  return {
    kind: 'pin',
    label: label || `${area} ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
    lat,
    lng,
    township,
    area,
  };
}

/** 在 Google 地圖開啟（用來選點，再把分享連結貼回） */
export function googleMapsUrl(lat?: number, lng?: number): string {
  return lat !== undefined && lng !== undefined
    ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
    : 'https://www.google.com/maps/@24.8,121.05,12z';
}
