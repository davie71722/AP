import { townshipAt } from '../data/boundaries';
import { HOSPITALS } from '../data/hospitals';
import { nearestTownship, TOWNSHIPS, unitCoord, type Unit } from '../data/places';
import type { IncidentLocation, TravelEntry, TravelState } from '../types';
import { estimateMinutes, haversineKm } from './offline';

/** 山區加成依轄區分隊（無則用鄉鎮） */
function sceneMountainKey(loc: IncidentLocation): string {
  return loc.unit ?? sceneTownship(loc);
}

export function sceneTownship(loc: IncidentLocation): string {
  return loc.township ?? townshipAt(loc.lat, loc.lng) ?? nearestTownship(loc.lat, loc.lng);
}

/** 以離線估算建立 現場↔各醫院 車程 */
export function offlineTravel(loc: IncidentLocation): Record<string, TravelEntry> {
  const tw = sceneMountainKey(loc);
  const out: Record<string, TravelEntry> = {};
  for (const h of HOSPITALS) {
    const m = estimateMinutes(loc.lat, loc.lng, h.lat, h.lng, [tw]);
    const km = haversineKm(loc.lat, loc.lng, h.lat, h.lng) * 1.35;
    out[h.id] = { go: m, back: m, source: 'offline', km };
  }
  return out;
}

export function offlineTravelState(loc: IncidentLocation | null, now: number): TravelState {
  return { byHospital: loc ? offlineTravel(loc) : {}, updatedAt: loc ? now : null, source: 'offline' };
}

/** 分隊所在鄉鎮 → 現場（離線估算，未乘倍率） */
/** 分隊 → 現場（離線估算，未乘倍率）；有分隊所在地座標者用之 */
export function etaFromUnit(u: Unit, loc: IncidentLocation): number {
  const [lat, lng] = unitCoord(u);
  return estimateMinutes(lat, lng, loc.lat, loc.lng, [u.name, sceneMountainKey(loc)]);
}

export function etaFromTownship(township: string, loc: IncidentLocation): number {
  const c = TOWNSHIPS[township];
  if (!c) return 15;
  return estimateMinutes(c[0], c[1], loc.lat, loc.lng, [township, sceneMountainKey(loc)]);
}

export function etaFromPoint(lat: number, lng: number, loc: IncidentLocation): number {
  return estimateMinutes(lat, lng, loc.lat, loc.lng, [sceneMountainKey(loc)]);
}
