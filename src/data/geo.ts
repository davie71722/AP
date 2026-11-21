// 事發地點輸入解析：座標、Google 地圖連結（含座標者可離線解析）
import { locate } from './places';
import type { IncidentLocation } from '../types';

const inTaiwan = (lat: number, lng: number) => lat > 21 && lat < 26.5 && lng > 118 && lng < 123;

/** 度分秒：24°49'48.0"N 121°00'43.2"E */
function parseDms(t: string): { lat: number; lng: number } | null {
  const re = /(\d{1,3})\s*°\s*(\d{1,2})\s*['′]\s*(\d{1,2}(?:\.\d+)?)\s*["″]?\s*([NSEW])/gi;
  const parts = [...t.matchAll(re)].map((m) => {
    const v = +m[1] + +m[2] / 60 + +m[3] / 3600;
    const d = m[4].toUpperCase();
    return { v: d === 'S' || d === 'W' ? -v : v, axis: d === 'N' || d === 'S' ? 'lat' : 'lng' };
  });
  const lat = parts.find((p) => p.axis === 'lat');
  const lng = parts.find((p) => p.axis === 'lng');
  return lat && lng ? check(lat.v, lng.v) : null;
}

/** 從文字取出座標：支援「24.83, 121.01」、度分秒、Google 地圖網址的 @、q=、query=、!3d…!4d… */
export function parseCoords(text: string): { lat: number; lng: number } | null {
  const t = text.trim();
  const dms = parseDms(t);
  if (dms) return dms;
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

/** 文字中的第一個網址（Google 地圖「分享」常是「地點名稱＋網址」） */
export function extractUrl(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s"'<>]+/i);
  return m ? m[0] : null;
}

/** Google 地圖短網址（需線上展開才有座標） */
export function mapsShortLink(text: string): string | null {
  const u = extractUrl(text);
  return u && /^https?:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps)\//i.test(u) ? u : null;
}

/** 分享文字中網址以外的部分（通常是地點名稱） */
export function shareName(text: string): string {
  return text
    .replace(/https?:\/\/[^\s"'<>]+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isUrl(text: string): boolean {
  return /^https?:\/\//i.test(text.trim());
}

export function pinLocation(lat: number, lng: number, label?: string): IncidentLocation {
  const { township, area, unit } = locate(lat, lng);
  return {
    kind: 'pin',
    label: label || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    lat,
    lng,
    township,
    area,
    unit,
  };
}

/** 在 Google 地圖開啟（用來選點，再把分享連結貼回） */
export function googleMapsUrl(lat?: number, lng?: number): string {
  return lat !== undefined && lng !== undefined
    ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
    : 'https://www.google.com/maps/@24.8,121.05,12z';
}
