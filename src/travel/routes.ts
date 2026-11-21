// 地圖服務（車程、地點搜尋、短網址展開）。三種後端，同一套請求格式：
//  1. GAS 網頁（本程式放在 Google Apps Script 上）：google.script.run.api(req)
//  2. GAS 網址（VITE_ROUTES_PROXY_URL=https://script.google.com/macros/s/…/exec）
//  3. Cloudflare Worker（proxy/cloudflare-worker.js，Google Routes／Places API，需金鑰）
// 一律以 text/plain 送 JSON，GAS 才不會因跨網域預檢而失敗。
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
/** 選用：GAS 後端設定 TOKEN 時一併送出，降低網址外流被濫用的機會 */
const MAP_TOKEN: string = (import.meta.env?.VITE_MAP_TOKEN as string | undefined) ?? '';

type GasRun = {
  withSuccessHandler(f: (r: unknown) => void): GasRun;
  withFailureHandler(f: (e: unknown) => void): GasRun;
  api(req: string): void;
};
function gasRun(): GasRun | null {
  const g = (globalThis as unknown as { google?: { script?: { run?: GasRun } } }).google;
  return g?.script?.run ?? null;
}

/** 是否有可用的地圖服務 */
export function mapServiceConfigured(): boolean {
  return !!gasRun() || !!ROUTES_PROXY_URL;
}

/** 後端是 GAS（內建 Maps 服務有每日額度，需省著用） */
export function isGasBackend(): boolean {
  return !!gasRun() || /script\.google(usercontent)?\.com/.test(ROUTES_PROXY_URL);
}

export function routesEnabled(): boolean {
  return mapServiceConfigured() && typeof navigator !== 'undefined' && navigator.onLine;
}

/** 呼叫地圖服務 */
async function callMapService<T>(body: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  const req = JSON.stringify(MAP_TOKEN ? { ...body, token: MAP_TOKEN } : body);
  const run = gasRun();
  if (run) {
    return new Promise<T>((resolve, reject) => {
      run
        .withSuccessHandler((r) => {
          try {
            const v = typeof r === 'string' ? JSON.parse(r) : r;
            if (v && typeof v === 'object' && 'error' in v && !('places' in v)) reject(new Error(String(v.error)));
            else resolve(v as T);
          } catch (e) {
            reject(e);
          }
        })
        .withFailureHandler((e) => reject(e instanceof Error ? e : new Error(String(e))))
        .api(req);
    });
  }
  const res = await fetch(ROUTES_PROXY_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: req, signal });
  if (!res.ok) throw new Error(`地圖服務回應 ${res.status}`);
  return (await res.json()) as T;
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
  const data = await callMapService<Array<Record<string, unknown>>>({ origins, destinations }, signal);
  if (!Array.isArray(data)) throw new Error('地圖服務回應格式錯誤');
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
 * 事故地點確定後查一次：現場 → 各醫院（回程沿用同一時間）、各分隊 → 現場。
 * 失敗時丟出例外，由呼叫端改用離線估算。
 */
export async function fetchOnlineTravel(
  scene: LatLng,
  hospitals: { id: string; lat: number; lng: number }[],
  units: { id: string; lat: number; lng: number }[],
  fallback: Record<string, TravelEntry>,
): Promise<{ byHospital: Record<string, TravelEntry>; unitEta: Record<string, number> }> {
  // GAS 逐筆查詢、可能冷啟動，等候較久
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), isGasBackend() ? 90000 : 20000);
  try {
    const [goEls, unitEls] = await Promise.all([
      computeRouteMatrix([scene], hospitals, ctrl.signal),
      units.length ? computeRouteMatrix(units, [scene], ctrl.signal) : Promise.resolve([] as MatrixElement[]),
    ]);
    const byHospital: Record<string, TravelEntry> = {};
    hospitals.forEach((h, i) => {
      const go = goEls.find((e) => e.destinationIndex === i)?.durationSec;
      const fb = fallback[h.id];
      byHospital[h.id] =
        go != null ? { go: go / 60, back: go / 60, source: 'online' } : { go: fb?.go ?? 60, back: fb?.back ?? 60, source: 'offline' };
    });
    const unitEta: Record<string, number> = {};
    units.forEach((u, k) => {
      const d = unitEls.find((e) => e.originIndex === k)?.durationSec;
      if (d != null) unitEta[u.id] = d / 60;
    });
    return { byHospital, unitEta };
  } finally {
    clearTimeout(timer);
  }
}

/** 地址 → 座標（經代理呼叫 Google Geocoding） */
export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number; label: string } | null> {
  const r = await callMapService<{ lat?: number; lng?: number; label?: string; error?: string }>({ address });
  return r.lat !== undefined && r.lng !== undefined ? { lat: r.lat, lng: r.lng, label: r.label ?? address } : null;
}

/** Google 地圖短網址展開 */
export async function resolveShortLink(url: string): Promise<string> {
  const r = await callMapService<{ url: string }>({ resolve: url });
  return r.url;
}

export interface PlaceHit {
  name: string;
  address: string;
  lat: number;
  lng: number;
  /** 只對到鄉鎮等概略位置（未找到該地標本身） */
  approximate?: boolean;
}

/** 店家、地標、地址搜尋（經代理呼叫 Google Places Text Search），回傳最多 5 個候選 */
export async function searchPlaces(query: string): Promise<PlaceHit[]> {
  const r = await callMapService<{ places?: PlaceHit[] }>({ search: query });
  return r.places ?? [];
}
