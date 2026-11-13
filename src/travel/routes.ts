// Google Routes API computeRouteMatrix（經後端代理，規格書 7.1、7.3）
// 前端只知道代理網址（VITE_ROUTES_PROXY_URL），金鑰只存在代理端。
import type { TravelEntry } from '../types';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface MatrixElement {
  originIndex: number;
  destinationIndex: number;
  durationSec: number | null;
  distanceMeters?: number;
}

export const ROUTES_PROXY_URL: string = (import.meta.env?.VITE_ROUTES_PROXY_URL as string | undefined) ?? '';

export function routesEnabled(): boolean {
  return !!ROUTES_PROXY_URL && typeof navigator !== 'undefined' && navigator.onLine;
}

function parseDuration(d: unknown): number | null {
  if (typeof d !== 'string') return null;
  const m = d.match(/^([\d.]+)s$/);
  return m ? parseFloat(m[1]) : null;
}

export async function computeRouteMatrix(
  origins: LatLng[],
  destinations: LatLng[],
  signal?: AbortSignal,
): Promise<MatrixElement[]> {
  const res = await fetch(ROUTES_PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ origins, destinations }),
    signal,
  });
  if (!res.ok) throw new Error(`Routes 代理回應 ${res.status}`);
  const data = (await res.json()) as Array<Record<string, unknown>>;
  return data
    .filter((e) => e.condition === undefined || e.condition === 'ROUTE_EXISTS')
    .map((e) => ({
      originIndex: (e.originIndex as number) ?? 0,
      destinationIndex: (e.destinationIndex as number) ?? 0,
      durationSec: parseDuration(e.duration),
      distanceMeters: e.distanceMeters as number | undefined,
    }));
}

/**
 * 雙向查詢：現場→各醫院、各醫院與趕赴中車輛所在地→現場。
 * 失敗時丟出例外，由呼叫端退回離線估算。
 */
export async function fetchOnlineTravel(
  scene: LatLng,
  hospitals: { id: string; lat: number; lng: number }[],
  vehicleOrigins: { id: string; lat: number; lng: number }[],
  fallback: Record<string, TravelEntry>,
): Promise<{ byHospital: Record<string, TravelEntry>; vehicleEta: Record<string, number> }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const [goEls, backEls] = await Promise.all([
      computeRouteMatrix([scene], hospitals, ctrl.signal),
      computeRouteMatrix([...hospitals, ...vehicleOrigins], [scene], ctrl.signal),
    ]);
    const byHospital: Record<string, TravelEntry> = {};
    hospitals.forEach((h, i) => {
      const go = goEls.find((e) => e.destinationIndex === i)?.durationSec;
      const back = backEls.find((e) => e.originIndex === i)?.durationSec;
      const fb = fallback[h.id];
      byHospital[h.id] = {
        go: go != null ? go / 60 : fb?.go ?? 60,
        back: back != null ? back / 60 : go != null ? go / 60 : fb?.back ?? 60,
        source: go != null ? 'online' : 'offline',
      };
    });
    const vehicleEta: Record<string, number> = {};
    vehicleOrigins.forEach((v, j) => {
      const d = backEls.find((e) => e.originIndex === hospitals.length + j)?.durationSec;
      if (d != null) vehicleEta[v.id] = d / 60;
    });
    return { byHospital, vehicleEta };
  } finally {
    clearTimeout(timer);
  }
}

async function proxyPost<T>(body: unknown): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(ROUTES_PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`代理回應 ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/** 地址 → 座標（經代理呼叫 Google Geocoding） */
export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number; label: string } | null> {
  const r = await proxyPost<{ lat?: number; lng?: number; label?: string; error?: string }>({ address });
  return r.lat !== undefined && r.lng !== undefined ? { lat: r.lat, lng: r.lng, label: r.label ?? address } : null;
}

/** Google 地圖短網址展開 */
export async function resolveShortLink(url: string): Promise<string> {
  const r = await proxyPost<{ url: string }>({ resolve: url });
  return r.url;
}
